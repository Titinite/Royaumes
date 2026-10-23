import { beforeEach, describe, expect, it } from 'vitest'
import { REALM_TOPICS } from '@/modules/realm/contracts'
import { createTestDatabase, type Db } from '@/platform/db/client'
import { createEventStore, type EventStore } from '@/platform/event-store/event-store'
import { outbox } from '@/platform/outbox/schema'
import { createProjectionRunner } from '@/platform/projection/projection'
import { QUESTS } from '../domain/catalog'
import { dailyQuests, dayOf } from '../domain/daily'
import { createDrizzleQuestRepository } from '../infrastructure/drizzle-quest-repository'
import { createQuestsService, type QuestsService } from './quests-service'

let db: Db
let store: EventStore
let service: QuestsService
let dispatched: number

beforeEach(async () => {
  db = await createTestDatabase()
  store = createEventStore(db)
  dispatched = 0
  const repo = createDrizzleQuestRepository(db, createProjectionRunner(db))
  service = createQuestsService(repo, { dispatch: async () => dispatched++ })
}, 15000)

/** Fonde le village d'un joueur. */
const found = (playerId: string) =>
  store.append(`village-${playerId}`, 0, [{ type: 'VillageFounded', data: { name: 'Valombre' } }])

/**
 * Réalise dans les autres modules toutes les actions du catalogue, en quantité suffisante
 * pour terminer n'importe quelle quête : le joueur termine ainsi ses quatre quêtes du jour.
 */
async function playEverything(playerId: string) {
  await store.append(`village-${playerId}`, 1, [
    { type: 'BuildingUpgraded', data: {} },
    { type: 'BuildingUpgraded', data: {} },
  ])
  for (const game of ['g1', 'g2', 'g3']) {
    await store.append(`dungeon-${playerId}-${game}`, 0, [
      { type: 'GameCreated', data: { hostId: playerId } },
      { type: 'GameEnded', data: { result: 'won' } },
    ])
  }
  await store.append(`dungeon-autre-${playerId}`, 0, [
    { type: 'GameCreated', data: { hostId: 'autre' } },
    { type: 'PlayerJoined', data: { playerId } },
  ])
  await store.append(`market-${playerId}`, 0, [
    { type: 'OfferPublished', data: { sellerId: playerId } },
  ])
  await store.append(`market-achat-${playerId}`, 0, [
    { type: 'OfferAccepted', data: { buyerId: playerId } },
    { type: 'TradeCompleted', data: {} },
  ])
}

/** Fonde le village du joueur, et le fait améliorer un bâtiment. */
async function upgradeOnce(playerId: string) {
  await found(playerId)
  await store.append(`village-${playerId}`, 1, [{ type: 'BuildingUpgraded', data: {} }])
}

/** Rang, dans le tableau du jour, d'une quête terminée par une seule amélioration ; -1 sinon. */
const builderSlot = (playerId: string) =>
  dailyQuests(playerId, dayOf(Date.now())).indexOf('builder')

/** Premier joueur dont les quêtes du jour comprennent « Bâtisseur ». */
function builderPlayer() {
  for (let i = 0; ; i++) if (builderSlot(`joueur-${i}`) >= 0) return `joueur-${i}`
}

describe('Service des quêtes - tableau du jour', () => {
  it('présente les quatre quêtes du jour, et leur progression à partir des autres modules', async () => {
    const player = builderPlayer()
    await upgradeOnce(player)
    const board = await service.board(player)
    expect(board.day).toBe(dayOf(Date.now()))
    expect(board.quests).toHaveLength(4)
    expect(board.quests[builderSlot(player)]).toMatchObject({
      kind: 'builder',
      progress: 1,
      completed: true,
      claimed: false,
    })
    expect(board.badge).toBe(false)
  })
})

describe('Service des quêtes - réclamation', () => {
  it('enregistre la réclamation, et demande au Village de verser la récompense', async () => {
    const player = builderPlayer()
    await upgradeOnce(player)
    const result = await service.claim(player, builderSlot(player))

    expect(result.ok && result.board.quests[builderSlot(player)].claimed).toBe(true)
    const messages = await db.select().from(outbox)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      topic: REALM_TOPICS.deposit,
      payload: {
        transferId: `quest-${dayOf(Date.now())}-builder-${player}`,
        playerId: player,
        resources: QUESTS.builder.reward,
      },
    })
    // La boîte d'envoi est distribuée aussitôt, pour un versement immédiat.
    expect(dispatched).toBe(1)
  })

  it("règle 7 : refuse une seconde réclamation, sans envoyer d'autre message", async () => {
    const player = builderPlayer()
    await upgradeOnce(player)
    await service.claim(player, builderSlot(player))
    expect(await service.claim(player, builderSlot(player))).toEqual({
      ok: false,
      error: { code: 'ALREADY_CLAIMED' },
    })
    expect(await db.select().from(outbox)).toHaveLength(1)
  })

  it("règle 7 : n'accepte qu'une réclamation parmi deux réclamations simultanées", async () => {
    const player = builderPlayer()
    await upgradeOnce(player)
    const results = await Promise.all([
      service.claim(player, builderSlot(player)),
      service.claim(player, builderSlot(player)),
    ])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(await db.select().from(outbox)).toHaveLength(1)
  })

  it('règle 6 : refuse la réclamation d’une quête non terminée', async () => {
    const player = builderPlayer()
    await found(player)
    expect(await service.claim(player, builderSlot(player))).toEqual({
      ok: false,
      error: { code: 'QUEST_NOT_COMPLETED' },
    })
    expect(await db.select().from(outbox)).toHaveLength(0)
  })

  it('règle 8 : refuse la réclamation à un joueur qui n’a pas fondé de village', async () => {
    // Le joueur rejoint et termine une expédition, sans avoir fondé de village.
    let player = ''
    for (let i = 0; !player; i++) {
      if (dailyQuests(`joueur-${i}`, dayOf(Date.now())).includes('adventurer'))
        player = `joueur-${i}`
    }
    await store.append('dungeon-g1', 0, [
      { type: 'GameCreated', data: { hostId: player } },
      { type: 'GameEnded', data: { result: 'lost' } },
    ])
    const slot = dailyQuests(player, dayOf(Date.now())).indexOf('adventurer')
    expect(await service.claim(player, slot)).toEqual({
      ok: false,
      error: { code: 'VILLAGE_REQUIRED' },
    })
  })
})

describe('Service des quêtes - badge du jour', () => {
  it('règle 9 : présente comme champions les seuls joueurs qui ont terminé leurs quatre quêtes', async () => {
    await found('alice')
    await playEverything('alice')
    await upgradeOnce('bob')

    expect((await service.board('alice')).badge).toBe(true)
    expect(await service.champions()).toEqual(['alice'])
  })
})
