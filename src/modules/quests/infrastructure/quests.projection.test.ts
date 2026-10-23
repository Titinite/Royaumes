import { and, eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, type Db } from '@/platform/db/client'
import {
  createEventStore,
  type EventStore,
  type NewEvent,
} from '@/platform/event-store/event-store'
import { createProjectionRunner, type ProjectionRunner } from '@/platform/projection/projection'
import { dayOf } from '../domain/daily'
import { questsProjection } from './quests-projection'
import { claims, counters, villages } from './schema'

let db: Db
let store: EventStore
let runner: ProjectionRunner

beforeEach(async () => {
  db = await createTestDatabase()
  store = createEventStore(db)
  runner = createProjectionRunner(db)
})

/** Métriques d'un joueur pour un jour, après rattrapage de la projection. */
async function countersOf(playerId: string, day = dayOf(Date.now())) {
  await runner.catchUp(questsProjection)
  const rows = await db
    .select()
    .from(counters)
    .where(and(eq(counters.playerId, playerId), eq(counters.day, day)))
  return Object.fromEntries(rows.map((row) => [row.metric, row.value]))
}

// Événements des autres modules, réduits aux champs lus par les Quêtes.
const created = (hostId: string): NewEvent => ({ type: 'GameCreated', data: { hostId } })
const joined = (playerId: string): NewEvent => ({ type: 'PlayerJoined', data: { playerId } })
const companion: NewEvent = { type: 'CompanionAdded', data: { companionId: 'companion-1' } }
const ended = (result: 'won' | 'lost'): NewEvent => ({ type: 'GameEnded', data: { result } })
const upgraded: NewEvent = { type: 'BuildingUpgraded', data: {} }

describe('Projection des quêtes - Village', () => {
  it('compte les améliorations du joueur, et enregistre la fondation de son village', async () => {
    await store.append('village-alice', 0, [
      { type: 'VillageFounded', data: { name: 'Valombre' } },
      upgraded,
      upgraded,
    ])
    expect(await countersOf('alice')).toEqual({ upgrades: 2 })
    expect(await db.select().from(villages)).toEqual([{ playerId: 'alice' }])
  })
})

describe('Projection des quêtes - règle 4 : seulement le joueur, seulement le jour', () => {
  it("n'attribue une action qu'au joueur qui l'a réalisée", async () => {
    await store.append('village-alice', 0, [upgraded])
    expect(await countersOf('alice')).toEqual({ upgrades: 1 })
    expect(await countersOf('bob')).toEqual({})
  })

  it("compte l'action pour le jour où elle a eu lieu, et non pour le jour de sa lecture", async () => {
    await store.append('village-alice', 0, [upgraded])
    // L'action est datée de la veille : elle ne compte pas pour aujourd'hui.
    await db.execute(sql`UPDATE platform.events SET occurred_at = now() - interval '1 day'`)
    const yesterday = dayOf(Date.now() - 86_400_000)
    expect(await countersOf('alice')).toEqual({})
    expect(await countersOf('alice', yesterday)).toEqual({ upgrades: 1 })
  })
})

describe('Projection des quêtes - Donjon', () => {
  it("attribue la fin d'une expédition gagnée à ses joueurs, sans les compagnons", async () => {
    await store.append('dungeon-g1', 0, [created('alice'), joined('bob'), companion, ended('won')])
    expect(await countersOf('alice')).toEqual({ gamesPlayed: 1, gamesWon: 1 })
    expect(await countersOf('bob')).toEqual({ gamesJoined: 1, gamesPlayed: 1, gamesWon: 1 })
    expect(await countersOf('companion-1')).toEqual({})
  })

  it('compte une défaite comme une expédition terminée, sans victoire', async () => {
    await store.append('dungeon-g1', 0, [created('alice'), ended('lost')])
    expect(await countersOf('alice')).toEqual({ gamesPlayed: 1 })
  })
})

describe('Projection des quêtes - Marché', () => {
  const published: NewEvent = { type: 'OfferPublished', data: { sellerId: 'alice' } }
  const accepted = (buyerId: string): NewEvent => ({ type: 'OfferAccepted', data: { buyerId } })

  it("compte l'offre publiée au vendeur, et l'achat à l'acheteur une fois l'échange conclu", async () => {
    await store.append('market-o1', 0, [published, accepted('bob')])
    expect(await countersOf('alice')).toEqual({ offersPublished: 1 })
    expect(await countersOf('bob')).toEqual({})

    await store.append('market-o1', 2, [{ type: 'TradeCompleted', data: {} }])
    expect(await countersOf('bob')).toEqual({ purchases: 1 })
  })

  it("ne compte pas d'achat pour un paiement refusé suivi du retrait de l'offre", async () => {
    await store.append('market-o1', 0, [
      published,
      accepted('bob'),
      { type: 'PaymentRefused', data: { buyerId: 'bob' } },
      { type: 'OfferWithdrawn', data: { reason: 'expired' } },
    ])
    expect(await countersOf('bob')).toEqual({})
  })
})

describe('Projection des quêtes - reconstruction', () => {
  it('reconstruit les métriques sans effacer les récompenses réclamées', async () => {
    await store.append('village-alice', 0, [upgraded])
    await runner.catchUp(questsProjection)
    await db
      .insert(claims)
      .values({ playerId: 'alice', day: dayOf(Date.now()), kind: 'builder', claimedAt: 1 })

    await runner.rebuild(questsProjection)
    expect(await countersOf('alice')).toEqual({ upgrades: 1 })
    expect(await db.select().from(claims)).toHaveLength(1)
  })
})
