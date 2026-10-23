import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, type Db } from '@/platform/db/client'
import {
  createEventStore,
  type EventStore,
  type NewEvent,
} from '@/platform/event-store/event-store'
import { createProjectionRunner, type ProjectionRunner } from '@/platform/projection/projection'
import { achievementsProjection } from './achievements-projection'
import { counters, unlocked } from './schema'

let db: Db
let store: EventStore
let runner: ProjectionRunner

beforeEach(async () => {
  db = await createTestDatabase()
  store = createEventStore(db)
  runner = createProjectionRunner(db)
})

/** Métriques d'un joueur, après rattrapage de la projection. */
async function countersOf(playerId: string) {
  await runner.catchUp(achievementsProjection)
  const rows = await db.select().from(counters).where(eq(counters.playerId, playerId))
  return Object.fromEntries(rows.map((row) => [row.metric, row.value]))
}

/** Hauts faits débloqués d'un joueur, avec leur date, après rattrapage de la projection. */
async function unlockedOf(playerId: string) {
  await runner.catchUp(achievementsProjection)
  const rows = await db.select().from(unlocked).where(eq(unlocked.playerId, playerId))
  return Object.fromEntries(rows.map((row) => [row.achievement, row.unlockedAt]))
}

// Événements des autres modules, réduits aux champs lus par les Hauts faits.
const upgraded = (at: number): NewEvent => ({ type: 'BuildingUpgraded', data: { at } })
const created = (hostId: string): NewEvent => ({ type: 'GameCreated', data: { hostId } })
const joined = (playerId: string): NewEvent => ({ type: 'PlayerJoined', data: { playerId } })
const companion: NewEvent = { type: 'CompanionAdded', data: { companionId: 'companion-1' } }
const ended = (result: 'won' | 'lost', loot: number, at = 1): NewEvent => ({
  type: 'GameEnded',
  data: { result, loot, at },
})

describe('Projection des hauts faits - règle 2 : seulement les actions du joueur', () => {
  it("cumule les métriques du joueur qui agit, et d'aucun autre", async () => {
    await store.append('village-alice', 0, [
      { type: 'VillageFounded', data: { name: 'Valombre', at: 1 } },
      upgraded(2),
      upgraded(3),
    ])
    expect(await countersOf('alice')).toEqual({ villagesFounded: 1, upgrades: 2 })
    expect(await countersOf('bob')).toEqual({})
  })

  it('attribue une expédition gagnée et son butin à ses joueurs, sans les compagnons', async () => {
    await store.append('dungeon-g1', 0, [
      created('alice'),
      joined('bob'),
      companion,
      ended('won', 120),
    ])
    expect(await countersOf('alice')).toEqual({ gamesPlayed: 1, gamesWon: 1, gold: 120 })
    expect(await countersOf('bob')).toEqual({
      gamesJoined: 1,
      gamesPlayed: 1,
      gamesWon: 1,
      gold: 120,
    })
    expect(await countersOf('companion-1')).toEqual({})
  })

  it("compte l'achat à l'acheteur seulement une fois l'échange conclu", async () => {
    await store.append('market-o1', 0, [
      { type: 'OfferPublished', data: { sellerId: 'alice' } },
      { type: 'OfferAccepted', data: { buyerId: 'bob' } },
    ])
    expect(await countersOf('bob')).toEqual({})
    await store.append('market-o1', 2, [{ type: 'TradeCompleted', data: {} }])
    expect(await countersOf('alice')).toEqual({ offersPublished: 1 })
    expect(await countersOf('bob')).toEqual({ purchases: 1 })
  })
})

describe('Projection des hauts faits - règles 3 et 6 : déblocage au seuil, daté par l’action', () => {
  it("débloque le haut fait à l'action qui atteint le seuil, avec la date de cette action", async () => {
    await store.append('village-alice', 0, [1, 2, 3, 4].map(upgraded))
    expect(await unlockedOf('alice')).toEqual({})
    await store.append('village-alice', 4, [upgraded(5000)])
    expect(await unlockedOf('alice')).toEqual({ 'builder-bronze': 5000 })
  })
})

describe('Projection des hauts faits - règles 4 et 6 : jamais deux fois, jamais retiré', () => {
  it('ne débloque pas de nouveau un haut fait, et conserve sa date lors d’une reconstruction', async () => {
    await store.append('village-alice', 0, [
      { type: 'VillageFounded', data: { name: 'Valombre', at: 1000 } },
    ])
    expect(await unlockedOf('alice')).toEqual({ 'first-steps': 1000 })
    const [before] = await db.select().from(unlocked)

    await runner.rebuild(achievementsProjection)
    const after = await db.select().from(unlocked)
    // Même date et même identifiant : le canal temps réel ne l'annonce pas une seconde fois.
    expect(after).toEqual([before])
  })
})

describe('Projection des hauts faits - règle 5 : plusieurs déblocages à la fois', () => {
  it('débloque, pour une même expédition gagnée, tous les hauts faits atteints', async () => {
    await store.append('dungeon-g1', 0, [created('alice'), ended('won', 600, 7000)])
    expect(await unlockedOf('alice')).toEqual({
      adventurer: 7000,
      'slayer-bronze': 7000,
      fortunate: 7000,
    })
  })
})
