import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { AchievementBoard } from '@/modules/achievements/contracts'
import { createTestApi } from './testing'

type TestApi = Awaited<ReturnType<typeof createTestApi>>

/** Catalogue des hauts faits d'un joueur, tel que l'API le renvoie. */
async function boardOf(api: TestApi, player: string) {
  const res = await api.get('/api/achievements', player)
  return ((await res.json()) as { board: AchievementBoard }).board
}

/** Date d'obtention d'un haut fait d'un joueur ; null s'il n'est pas débloqué. */
async function unlockedAt(api: TestApi, player: string, id: string) {
  return (await boardOf(api, player)).achievements.find((a) => a.id === id)?.unlockedAt
}

describe('API du module Hauts faits - accès', () => {
  it('refuse la route et le canal à une requête anonyme (401)', async () => {
    const api = await createTestApi()
    expect((await api.get('/api/achievements', null)).status).toBe(401)
    expect((await api.get('/api/stream/achievements-alice/events?after=0', null)).status).toBe(401)
  })
})

describe('API du module Hauts faits - GET /api/achievements', () => {
  it('présente tout le catalogue, et débloque « Premier pas » à la fondation du village', async () => {
    const api = await createTestApi()
    const before = await boardOf(api, 'alice')
    expect(before).toMatchObject({ total: 12, unlockedCount: 0 })

    await api.post('/api/realm/village', { name: 'Valombre' }, 'alice')
    // Date de l'action, selon l'horloge de l'application de test (1er janvier 2026).
    expect(await unlockedAt(api, 'alice', 'first-steps')).toBe(Date.UTC(2026, 0, 1))
    expect((await boardOf(api, 'alice')).unlockedCount).toBe(1)
  })

  it('règle 7 : ne présente à un joueur que ses propres hauts faits', async () => {
    const api = await createTestApi()
    await api.post('/api/realm/village', { name: 'Valombre' }, 'alice')
    expect((await boardOf(api, 'bob')).unlockedCount).toBe(0)
  })
})

describe('API du module Hauts faits - canal temps réel', () => {
  it('annonce un haut fait débloqué sur le canal du joueur, avec son libellé', async () => {
    const api = await createTestApi()
    await api.post('/api/realm/village', { name: 'Valombre' }, 'alice')

    const res = await api.get('/api/stream/achievements-alice/events?after=0', 'alice')
    expect(res.status).toBe(200)
    const { events } = await res.json()
    expect(events).toMatchObject([
      {
        type: 'AchievementUnlocked',
        data: { achievement: 'first-steps', label: 'Premier pas' },
      },
    ])
  })

  it("règle 7 : refuse à un joueur le canal des hauts faits d'un autre joueur (403)", async () => {
    const api = await createTestApi()
    expect((await api.get('/api/stream/achievements-alice/events?after=0', 'bob')).status).toBe(403)
  })
})

describe('API du module Hauts faits - données personnelles', () => {
  it("inclut les hauts faits dans l'export, et les efface avec le compte", async () => {
    const api = await createTestApi()
    await api.post('/api/realm/village', { name: 'Valombre' }, 'alice')

    const { sections } = await (await api.get('/api/account/export', 'alice')).json()
    expect(sections.achievements).toMatchObject({
      counters: [{ metric: 'villagesFounded', value: 1 }],
      unlocked: [{ achievement: 'first-steps' }],
    })

    await api.api.request('/api/account', { method: 'DELETE', headers: { 'x-test-user': 'alice' } })
    for (const table of ['counters', 'unlocked']) {
      const result = await api.db.execute(
        sql`SELECT player_id FROM ${sql.raw(`achievements.${table}`)} WHERE player_id = 'alice'`,
      )
      expect((result as unknown as { rows: unknown[] }).rows).toEqual([])
    }
  })
})
