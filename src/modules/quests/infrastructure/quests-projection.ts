import { eq, sql } from 'drizzle-orm'
import { GAME_CHANNEL_PREFIX } from '@/modules/dungeon/contracts'
import { OFFER_STREAM_PREFIX } from '@/modules/market/contracts'
import { VILLAGE_CHANNEL_PREFIX } from '@/modules/realm/contracts'
import type { StoredEvent } from '@/platform/event-store/event-store'
import type { DbTransaction, Projection } from '@/platform/projection/projection'
import type { Metric } from '../domain/catalog'
import { dayOf } from '../domain/daily'
import { counters, gamePlayers, offerBuyers, villages } from './schema'

/*
 * Données des événements lus par les Quêtes. Elles forment le « langage publié » du Village,
 * du Donjon et du Marché : les Quêtes en dépendent, comme tout lecteur du journal.
 * Seuls les champs utiles sont décrits.
 */
interface GameCreatedData {
  hostId: string
}
interface PlayerJoinedData {
  playerId: string
}
interface GameEndedData {
  result: 'won' | 'lost'
}
interface OfferPublishedData {
  sellerId: string
}
interface OfferAcceptedData {
  buyerId: string
}

/** Identifiant tiré du nom d'un flux : « dungeon-7f3a » donne « 7f3a ». */
const idFrom = (event: StoredEvent, prefix: string) => event.stream.slice(prefix.length)

/**
 * Instant de l'action : la date « at » que chaque module inscrit dans ses événements, selon
 * sa propre horloge ; à défaut, la date d'enregistrement de l'événement dans le journal.
 */
function actionTime(event: StoredEvent): number {
  const at = event.data.at
  return typeof at === 'number' ? at : event.occurredAt.getTime()
}

/**
 * Ajoute une unité à la métrique d'un joueur, pour le jour où l'action a eu lieu (règle 4),
 * et non pour le jour où la projection la lit : une reconstruction donne le même résultat.
 */
async function increment(tx: DbTransaction, event: StoredEvent, playerId: string, metric: Metric) {
  const day = dayOf(actionTime(event))
  await tx
    .insert(counters)
    .values({ playerId, day, metric, value: 1 })
    .onConflictDoUpdate({
      target: [counters.playerId, counters.day, counters.metric],
      set: { value: sql`${counters.value} + 1` },
    })
}

/**
 * Projection des quêtes : tient les métriques quotidiennes de chaque joueur à partir du journal
 * des autres modules. Le moteur des projections applique chaque événement exactement une fois :
 * une action n'est jamais comptée deux fois.
 */
export const questsProjection: Projection = {
  name: 'quests',
  version: 1,
  eventTypes: [
    'VillageFounded',
    'BuildingUpgraded',
    'GameCreated',
    'PlayerJoined',
    'GameEnded',
    'OfferPublished',
    'OfferAccepted',
    'TradeCompleted',
    'OfferWithdrawn',
  ],

  async apply(event, tx) {
    switch (event.type) {
      case 'VillageFounded': {
        const playerId = idFrom(event, VILLAGE_CHANNEL_PREFIX)
        await tx.insert(villages).values({ playerId }).onConflictDoNothing()
        return
      }

      case 'BuildingUpgraded':
        await increment(tx, event, idFrom(event, VILLAGE_CHANNEL_PREFIX), 'upgrades')
        return

      // L'hôte est le premier participant ; les compagnons ne sont jamais enregistrés.
      // DETTE TECHNIQUE : une expédition jamais terminée laisse ses participants (DT-013).
      case 'GameCreated': {
        // L'hôte est le premier participant ; les compagnons ne sont jamais enregistrés.
        const data = event.data as unknown as GameCreatedData
        const gameId = idFrom(event, GAME_CHANNEL_PREFIX)
        await tx.insert(gamePlayers).values({ gameId, playerId: data.hostId }).onConflictDoNothing()
        return
      }

      case 'PlayerJoined': {
        // Rejoindre une expédition, c'est rejoindre celle d'un autre joueur : l'hôte n'émet
        // jamais cet événement.
        const data = event.data as unknown as PlayerJoinedData
        const gameId = idFrom(event, GAME_CHANNEL_PREFIX)
        await tx
          .insert(gamePlayers)
          .values({ gameId, playerId: data.playerId })
          .onConflictDoNothing()
        await increment(tx, event, data.playerId, 'gamesJoined')
        return
      }

      case 'GameEnded': {
        // La fin de l'expédition est attribuée à ses joueurs humains, compagnons exclus.
        const data = event.data as unknown as GameEndedData
        const gameId = idFrom(event, GAME_CHANNEL_PREFIX)
        const rows = await tx.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId))
        for (const { playerId } of rows) {
          await increment(tx, event, playerId, 'gamesPlayed')
          if (data.result === 'won') await increment(tx, event, playerId, 'gamesWon')
        }
        // L'expédition est terminée : la liste de ses joueurs n'est plus utile.
        await tx.delete(gamePlayers).where(eq(gamePlayers.gameId, gameId))
        return
      }

      case 'OfferPublished': {
        const data = event.data as unknown as OfferPublishedData
        await increment(tx, event, data.sellerId, 'offersPublished')
        return
      }

      case 'OfferAccepted': {
        // Un achat n'est compté qu'une fois l'échange conclu : l'acheteur est retenu d'ici là.
        // Après un paiement refusé, un autre acheteur peut accepter l'offre et le remplacer.
        const data = event.data as unknown as OfferAcceptedData
        const offerId = idFrom(event, OFFER_STREAM_PREFIX)
        await tx
          .insert(offerBuyers)
          .values({ offerId, buyerId: data.buyerId })
          .onConflictDoUpdate({ target: offerBuyers.offerId, set: { buyerId: data.buyerId } })
        return
      }

      case 'TradeCompleted': {
        const offerId = idFrom(event, OFFER_STREAM_PREFIX)
        const [row] = await tx.select().from(offerBuyers).where(eq(offerBuyers.offerId, offerId))
        if (row) await increment(tx, event, row.buyerId, 'purchases')
        await tx.delete(offerBuyers).where(eq(offerBuyers.offerId, offerId))
        return
      }

      case 'OfferWithdrawn':
        await tx
          .delete(offerBuyers)
          .where(eq(offerBuyers.offerId, idFrom(event, OFFER_STREAM_PREFIX)))
        return
    }
  },

  // Seules les tables tenues par la projection sont vidées. Les récompenses réclamées ne
  // proviennent pas du journal : une reconstruction ne doit jamais les effacer.
  async reset(tx) {
    await tx.delete(counters)
    await tx.delete(villages)
    await tx.delete(gamePlayers)
    await tx.delete(offerBuyers)
  },
}
