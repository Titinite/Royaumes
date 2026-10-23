import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, type Db } from '@/platform/db/client'
import { createProjectionRunner } from '@/platform/projection/projection'
import { counters, gamePlayers, offerBuyers, unlocked } from './infrastructure/schema'
import { createAchievementsPersonalData } from './personal-data'

let db: Db

beforeEach(async () => {
  db = await createTestDatabase()
  // Données de deux joueurs : seules celles d'alice doivent être exportées ou effacées.
  for (const playerId of ['alice', 'bob']) {
    await db.insert(counters).values({ playerId, metric: 'upgrades', value: 5 })
    await db.insert(unlocked).values({ playerId, achievement: 'builder-bronze', unlockedAt: 42 })
    await db.insert(gamePlayers).values({ gameId: 'g1', playerId })
    await db.insert(offerBuyers).values({ offerId: `offre-${playerId}`, buyerId: playerId })
  }
})

describe('Hauts faits - données personnelles', () => {
  it('exporte les métriques et les hauts faits du joueur, et seulement les siens', async () => {
    const contributor = createAchievementsPersonalData(db, createProjectionRunner(db))
    expect(await contributor.export('alice')).toEqual({
      counters: [{ metric: 'upgrades', value: 5 }],
      unlocked: [{ achievement: 'builder-bronze', unlockedAt: 42 }],
    })
  })

  it("efface toutes les lignes du joueur, sans toucher à celles d'un autre joueur", async () => {
    await createAchievementsPersonalData(db, createProjectionRunner(db)).erase?.('alice', [])
    for (const [table, column] of [
      [counters, counters.playerId],
      [unlocked, unlocked.playerId],
      [gamePlayers, gamePlayers.playerId],
      [offerBuyers, offerBuyers.buyerId],
    ] as const) {
      const rows = (await db.select({ id: column }).from(table)).map((row) => row.id)
      expect(rows).toEqual(['bob'])
    }
  })
})
