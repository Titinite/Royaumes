import { asc, eq } from 'drizzle-orm'
import type { Db } from '@/platform/db/client'
import type { PersonalDataContributor } from '@/platform/privacy/privacy'
import { claims, counters, gamePlayers, offerBuyers, villages } from './infrastructure/schema'

/**
 * Données personnelles des Quêtes : la progression et les récompenses réclamées du joueur,
 * rattachées à son identifiant. Le module n'enregistre pas d'événements : il n'a rien à
 * réécrire dans le journal, et l'effacement est une simple suppression.
 */
export function createQuestsPersonalData(db: Db): PersonalDataContributor {
  return {
    name: 'quests',

    async export(playerId) {
      return {
        progress: await db
          .select({ day: counters.day, metric: counters.metric, value: counters.value })
          .from(counters)
          .where(eq(counters.playerId, playerId))
          .orderBy(asc(counters.day), asc(counters.metric)),
        claims: await db
          .select({ day: claims.day, quest: claims.kind, claimedAt: claims.claimedAt })
          .from(claims)
          .where(eq(claims.playerId, playerId))
          .orderBy(asc(claims.day), asc(claims.kind)),
        villageFounded:
          (await db.select().from(villages).where(eq(villages.playerId, playerId))).length > 0,
      }
    },

    // Les tables de travail de la projection (village fondé, expéditions et achats en cours)
    // ne contiennent que l'identifiant du joueur : elles sont supprimées avec le reste.
    async erase(playerId) {
      await db.delete(counters).where(eq(counters.playerId, playerId))
      await db.delete(claims).where(eq(claims.playerId, playerId))
      await db.delete(villages).where(eq(villages.playerId, playerId))
      await db.delete(gamePlayers).where(eq(gamePlayers.playerId, playerId))
      await db.delete(offerBuyers).where(eq(offerBuyers.buyerId, playerId))
    },
  }
}
