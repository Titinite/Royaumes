import { eq, sql } from 'drizzle-orm'
import { GAME_CHANNEL_PREFIX } from '@/modules/dungeon/contracts'
import { OFFER_STREAM_PREFIX } from '@/modules/market/contracts'
import { VILLAGE_CHANNEL_PREFIX } from '@/modules/realm/contracts'
import type { StoredEvent } from '@/platform/event-store/event-store'
import type { DbTransaction, Projection } from '@/platform/projection/projection'
import type { Metric } from '../domain/catalog'
import { unlockedBy } from '../domain/rules'
import { counters, gamePlayers, offerBuyers, unlocked } from './schema'

/*
 * Données des événements lus par les Hauts faits : le « langage publié » du Village,
 * du Donjon et du Marché. Seuls les champs utiles sont décrits.
 */
interface GameCreatedData {
  hostId: string
}
interface PlayerJoinedData {
  playerId: string
}
interface GameEndedData {
  result: 'won' | 'lost'
  loot: number
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
 * Instant de l'action : la date « at » que chaque module inscrit dans ses événements ;
 * à défaut, la date d'enregistrement de l'événement dans le journal.
 */
function actionTime(event: StoredEvent): number {
  const at = event.data.at
  return typeof at === 'number' ? at : event.occurredAt.getTime()
}

/**
 * Augmente la métrique d'un joueur, puis enregistre les hauts faits dont elle vient de franchir
 * le seuil, datés de l'action qui les a débloqués (règle 6). Un haut fait déjà enregistré
 * n'est jamais remplacé : sa date et son identifiant restent ceux du premier déblocage.
 */
async function add(
  tx: DbTransaction,
  event: StoredEvent,
  playerId: string,
  metric: Metric,
  amount = 1,
) {
  if (amount <= 0) return
  const [row] = await tx
    .insert(counters)
    .values({ playerId, metric, value: amount })
    .onConflictDoUpdate({
      target: [counters.playerId, counters.metric],
      set: { value: sql`${counters.value} + ${amount}` },
    })
    .returning({ value: counters.value })
  const after = row.value
  for (const achievement of unlockedBy({ [metric]: after - amount }, { [metric]: after })) {
    await tx
      .insert(unlocked)
      .values({ playerId, achievement, unlockedAt: actionTime(event) })
      .onConflictDoNothing()
  }
}

/**
 * Projection des hauts faits : tient les métriques cumulées de chaque joueur à partir du
 * journal des autres modules, et enregistre les hauts faits au franchissement de leur seuil.
 */
export const achievementsProjection: Projection = {
  name: 'achievements',
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
      case 'VillageFounded':
        await add(tx, event, idFrom(event, VILLAGE_CHANNEL_PREFIX), 'villagesFounded')
        return

      case 'BuildingUpgraded':
        await add(tx, event, idFrom(event, VILLAGE_CHANNEL_PREFIX), 'upgrades')
        return

      case 'GameCreated': {
        // L'hôte est le premier participant ; les compagnons ne sont jamais enregistrés.
        // DETTE TECHNIQUE : une expédition jamais terminée laisse ses participants (DT-014).
        const data = event.data as unknown as GameCreatedData
        const gameId = idFrom(event, GAME_CHANNEL_PREFIX)
        await tx.insert(gamePlayers).values({ gameId, playerId: data.hostId }).onConflictDoNothing()
        return
      }

      case 'PlayerJoined': {
        const data = event.data as unknown as PlayerJoinedData
        const gameId = idFrom(event, GAME_CHANNEL_PREFIX)
        await tx
          .insert(gamePlayers)
          .values({ gameId, playerId: data.playerId })
          .onConflictDoNothing()
        await add(tx, event, data.playerId, 'gamesJoined')
        return
      }

      case 'GameEnded': {
        const data = event.data as unknown as GameEndedData
        const gameId = idFrom(event, GAME_CHANNEL_PREFIX)
        const rows = await tx.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId))
        const won = data.result === 'won'
        for (const { playerId } of rows) {
          await add(tx, event, playerId, 'gamesPlayed')
          if (won) {
            await add(tx, event, playerId, 'gamesWon')
            await add(tx, event, playerId, 'gold', data.loot ?? 0)
          }
        }
        await tx.delete(gamePlayers).where(eq(gamePlayers.gameId, gameId))
        return
      }

      case 'OfferPublished': {
        const data = event.data as unknown as OfferPublishedData
        await add(tx, event, data.sellerId, 'offersPublished')
        return
      }

      case 'OfferAccepted': {
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
        if (row) await add(tx, event, row.buyerId, 'purchases')
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

  // Les hauts faits débloqués ne sont jamais retirés (règle 4) : une reconstruction recalcule
  // les métriques, mais conserve les hauts faits, avec leur date et leur identifiant d'origine.
  async reset(tx) {
    await tx.delete(counters)
    await tx.delete(gamePlayers)
    await tx.delete(offerBuyers)
  },
}
