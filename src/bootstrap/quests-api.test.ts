import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { QuestBoard } from '@/modules/quests/contracts'
import { dailyQuests } from '@/modules/quests/domain/daily'
import { createTestApi, TEST_CRON_SECRET } from './testing'

type TestApi = Awaited<ReturnType<typeof createTestApi>>

/** Jour de l'horloge de l'application de test (createTestApi part du 1er janvier 2026). */
const DAY = '2026-01-01'

/** Premier joueur dont les quêtes du jour comprennent « Bâtisseur », et le rang de cette quête. */
function builder() {
  for (let i = 0; ; i++) {
    const slot = dailyQuests(`joueur-${i}`, DAY).indexOf('builder')
    if (slot >= 0) return { player: `joueur-${i}`, slot }
  }
}

/** Le joueur fonde son village et améliore sa scierie : la quête « Bâtisseur » est terminée. */
async function completeBuilder(api: TestApi, player: string) {
  await api.post('/api/realm/village', { name: 'Valombre' }, player)
  expect(
    (await api.post('/api/realm/village/upgrade', { building: 'sawmill' }, player)).status,
  ).toBe(200)
}

/** Tableau des quêtes du jour d'un joueur. */
async function boardOf(api: TestApi, player: string) {
  const res = await api.get('/api/quests', player)
  return ((await res.json()) as { board: QuestBoard }).board
}

/** Bois du village d'un joueur. */
async function woodOf(api: TestApi, player: string) {
  const res = await api.get('/api/realm/village', player)
  return (await res.json()).view.stock.wood as number
}

describe('API du module Quêtes - accès', () => {
  it('refuse toutes les routes à une requête anonyme (401)', async () => {
    const api = await createTestApi()
    expect((await api.get('/api/quests', null)).status).toBe(401)
    expect((await api.get('/api/quests/champions', null)).status).toBe(401)
    expect((await api.post('/api/quests/0/claim', {}, null)).status).toBe(401)
  })
})

describe('API du module Quêtes - GET /api/quests', () => {
  it('présente les quatre quêtes du jour du joueur connecté, et leur progression', async () => {
    const api = await createTestApi()
    const { player, slot } = builder()
    await completeBuilder(api, player)

    const board = await boardOf(api, player)
    expect(board.day).toBe(DAY)
    expect(board.quests).toHaveLength(4)
    expect(board.quests[slot]).toMatchObject({ kind: 'builder', completed: true, claimed: false })
    // Un autre joueur ne voit que ses propres quêtes, sans la progression du premier.
    const other = await boardOf(api, 'carol')
    expect(other.quests.every((quest) => quest.progress === 0)).toBe(true)
  })
})

describe('API du module Quêtes - POST /api/quests/:slot/claim', () => {
  it('verse la récompense au village du joueur, une seule fois', async () => {
    const api = await createTestApi()
    const { player, slot } = builder()
    await completeBuilder(api, player)
    const before = await woodOf(api, player)

    const res = await api.post(`/api/quests/${slot}/claim`, {}, player)
    expect(res.status).toBe(200)
    expect((await res.json()).board.quests[slot].claimed).toBe(true)
    // La boîte d'envoi a été distribuée : le Village a déjà versé les 50 bois.
    expect(await woodOf(api, player)).toBe(before + 50)

    const again = await api.post(`/api/quests/${slot}/claim`, {}, player)
    expect(again.status).toBe(409)
    expect((await again.json()).error.code).toBe('ALREADY_CLAIMED')
    expect(await woodOf(api, player)).toBe(before + 50)
  })

  it('refuse la réclamation d’une quête non terminée (409)', async () => {
    const api = await createTestApi()
    const { player, slot } = builder()
    await api.post('/api/realm/village', { name: 'Valombre' }, player)
    const res = await api.post(`/api/quests/${slot}/claim`, {}, player)
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('QUEST_NOT_COMPLETED')
  })

  it('refuse un rang de quête invalide (400)', async () => {
    const api = await createTestApi()
    for (const slot of ['4', '-1', 'abc', '1.5']) {
      const res = await api.post(`/api/quests/${slot}/claim`, {}, 'alice')
      expect(res.status).toBe(400)
      expect((await res.json()).error.code).toBe('INVALID_INPUT')
    }
  })
})

describe('API du module Quêtes - GET /api/quests/champions', () => {
  it("ne présente pas un joueur qui n'a pas terminé ses quatre quêtes", async () => {
    const api = await createTestApi()
    const { player } = builder()
    await completeBuilder(api, player)
    const res = await api.get('/api/quests/champions', 'carol')
    expect(res.status).toBe(200)
    expect((await res.json()).playerIds).toEqual([])
  })
})

describe('API du module Quêtes - données personnelles', () => {
  it("inclut les quêtes dans l'export, et les efface avec le compte", async () => {
    const api = await createTestApi()
    const { player, slot } = builder()
    await completeBuilder(api, player)
    await api.post(`/api/quests/${slot}/claim`, {}, player)

    const { sections } = await (await api.get('/api/account/export', player)).json()
    expect(sections.quests).toMatchObject({
      progress: [{ day: DAY, metric: 'upgrades', value: 1 }],
      claims: [{ day: DAY, quest: 'builder' }],
      villageFounded: true,
    })

    await api.api.request('/api/account', { method: 'DELETE', headers: { 'x-test-user': player } })
    for (const table of ['counters', 'claims', 'villages']) {
      const result = await api.db.execute(
        sql`SELECT player_id FROM ${sql.raw(`quests.${table}`)} WHERE player_id = ${player}`,
      )
      expect((result as unknown as { rows: unknown[] }).rows).toEqual([])
    }
  })
})

describe('API du module Quêtes - tâche quotidienne', () => {
  it('supprime les données de plus de sept jours, et conserve les plus récentes', async () => {
    const api = await createTestApi()
    // L'horloge de test est au 1er janvier 2026 : le premier jour conservé est le 26 décembre.
    for (const day of ['2025-12-25', '2025-12-26']) {
      await api.db.execute(
        sql`INSERT INTO quests.counters (player_id, day, metric, value) VALUES ('alice', ${day}, 'upgrades', 1)`,
      )
      await api.db.execute(
        sql`INSERT INTO quests.claims (player_id, day, kind, claimed_at) VALUES ('alice', ${day}, 'builder', 0)`,
      )
    }

    const res = await api.api.request('/api/cron/daily', {
      headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
    })
    expect((await res.json()).quests).toEqual({ ok: true, result: { counters: 1, claims: 1 } })

    for (const table of ['counters', 'claims']) {
      const result = await api.db.execute(sql`SELECT day FROM ${sql.raw(`quests.${table}`)}`)
      expect((result as unknown as { rows: unknown[] }).rows).toEqual([{ day: '2025-12-26' }])
    }
  })
})
