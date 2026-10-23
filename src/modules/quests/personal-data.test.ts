import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, type Db } from '@/platform/db/client'
import { createProjectionRunner } from '@/platform/projection/projection'
import { claims, counters, gamePlayers, offerBuyers, villages } from './infrastructure/schema'
import { createQuestsPersonalData } from './personal-data'

let db: Db

beforeEach(async () => {
  db = await createTestDatabase()
  // Données de deux joueurs : seules celles d'alice doivent être exportées ou effacées.
  for (const playerId of ['alice', 'bob']) {
    await db.insert(counters).values({ playerId, day: '2026-10-23', metric: 'upgrades', value: 2 })
    await db.insert(claims).values({ playerId, day: '2026-10-23', kind: 'builder', claimedAt: 1 })
    await db.insert(villages).values({ playerId })
    await db.insert(gamePlayers).values({ gameId: 'g1', playerId })
    await db.insert(offerBuyers).values({ offerId: `offre-${playerId}`, buyerId: playerId })
  }
})

describe('Quêtes - données personnelles', () => {
  it('exporte la progression et les récompenses du joueur, et seulement les siennes', async () => {
    const data = await createQuestsPersonalData(db, createProjectionRunner(db)).export('alice')
    expect(data).toEqual({
      progress: [{ day: '2026-10-23', metric: 'upgrades', value: 2 }],
      claims: [{ day: '2026-10-23', quest: 'builder', claimedAt: 1 }],
      villageFounded: true,
    })
  })

  it("efface toutes les lignes du joueur, sans toucher à celles d'un autre joueur", async () => {
    await createQuestsPersonalData(db, createProjectionRunner(db)).erase?.('alice', [])
    for (const [table, column] of [
      [counters, counters.playerId],
      [claims, claims.playerId],
      [villages, villages.playerId],
      [gamePlayers, gamePlayers.playerId],
      [offerBuyers, offerBuyers.buyerId],
    ] as const) {
      const rows = (await db.select({ id: column }).from(table)).map((row) => row.id)
      expect(rows).toEqual(['bob'])
    }
  })
})
