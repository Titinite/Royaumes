import { and, asc, eq, gt, max } from 'drizzle-orm'
import type { Db } from '@/platform/db/client'
import type { ProjectionRunner } from '@/platform/projection/projection'
import type { AchievementRepository } from '../application/achievement-repository'
import type { AchievementId, Counters } from '../domain/catalog'
import { achievementsProjection } from './achievements-projection'
import { counters, unlocked } from './schema'

/** Adaptateur du port AchievementRepository, fondé sur les tables du schéma achievements. */
export function createDrizzleAchievementRepository(
  db: Db,
  projections: ProjectionRunner,
): AchievementRepository {
  /** Rattrape la projection, afin que chaque lecture tienne compte des dernières actions. */
  const catchUp = () => projections.catchUp(achievementsProjection)

  return {
    async counters(playerId) {
      await catchUp()
      const rows = await db.select().from(counters).where(eq(counters.playerId, playerId))
      return Object.fromEntries(rows.map((row) => [row.metric, row.value])) as Counters
    },

    async unlockedAfter(playerId, after) {
      await catchUp()
      const rows = await db
        .select()
        .from(unlocked)
        .where(and(eq(unlocked.playerId, playerId), gt(unlocked.id, after)))
        .orderBy(asc(unlocked.id))
      return rows.map((row) => ({
        id: row.id,
        achievement: row.achievement as AchievementId,
        unlockedAt: row.unlockedAt,
      }))
    },

    async lastPosition(playerId) {
      await catchUp()
      const [row] = await db
        .select({ value: max(unlocked.id) })
        .from(unlocked)
        .where(eq(unlocked.playerId, playerId))
      return Number(row?.value ?? 0)
    },
  }
}
