import { asc, eq } from 'drizzle-orm'
import type { Db } from '@/platform/db/client'
import type { PersonalDataContributor } from '@/platform/privacy/privacy'
import type { ProjectionRunner } from '@/platform/projection/projection'
import { achievementsProjection } from './infrastructure/achievements-projection'
import { counters, gamePlayers, offerBuyers, unlocked } from './infrastructure/schema'

/**
 * Données personnelles des Hauts faits : les métriques et les hauts faits débloqués du joueur,
 * rattachés à son identifiant. Le module n'enregistre pas d'événements : il n'a rien à réécrire
 * dans le journal, et l'effacement est une simple suppression.
 */
export function createAchievementsPersonalData(
  db: Db,
  projections: ProjectionRunner,
): PersonalDataContributor {
  return {
    name: 'achievements',

    async export(playerId) {
      // Comme toute lecture du module, l'export rattrape d'abord la projection.
      await projections.catchUp(achievementsProjection)
      return {
        counters: await db
          .select({ metric: counters.metric, value: counters.value })
          .from(counters)
          .where(eq(counters.playerId, playerId))
          .orderBy(asc(counters.metric)),
        unlocked: await db
          .select({ achievement: unlocked.achievement, unlockedAt: unlocked.unlockedAt })
          .from(unlocked)
          .where(eq(unlocked.playerId, playerId))
          .orderBy(asc(unlocked.id)),
      }
    },

    async erase(playerId) {
      await db.delete(counters).where(eq(counters.playerId, playerId))
      await db.delete(unlocked).where(eq(unlocked.playerId, playerId))
      await db.delete(gamePlayers).where(eq(gamePlayers.playerId, playerId))
      await db.delete(offerBuyers).where(eq(offerBuyers.buyerId, playerId))
    },
  }
}
