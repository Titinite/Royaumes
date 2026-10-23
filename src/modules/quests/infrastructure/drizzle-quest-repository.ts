import { and, eq, lt } from 'drizzle-orm'
import type { Db } from '@/platform/db/client'
import { enqueue } from '@/platform/outbox/outbox'
import type { ProjectionRunner } from '@/platform/projection/projection'
import type { QuestRepository } from '../application/quest-repository'
import type { Counters, Metric, QuestKind } from '../domain/catalog'
import { questsProjection } from './quests-projection'
import { claims, counters, villages } from './schema'

/** Adaptateur du port QuestRepository, fondé sur les tables du schéma quests. */
export function createDrizzleQuestRepository(
  db: Db,
  projections: ProjectionRunner,
): QuestRepository {
  /** Rattrape la projection, afin que chaque lecture tienne compte des dernières actions. */
  const catchUp = () => projections.catchUp(questsProjection)

  return {
    async counters(playerId, day) {
      await catchUp()
      const rows = await db
        .select()
        .from(counters)
        .where(and(eq(counters.playerId, playerId), eq(counters.day, day)))
      return Object.fromEntries(rows.map((row) => [row.metric, row.value])) as Counters
    },

    async countersOfDay(day) {
      await catchUp()
      const rows = await db.select().from(counters).where(eq(counters.day, day))
      const byPlayer = new Map<string, Counters>()
      for (const row of rows) {
        const current = byPlayer.get(row.playerId) ?? {}
        byPlayer.set(row.playerId, { ...current, [row.metric as Metric]: row.value })
      }
      return byPlayer
    },

    async claimed(playerId, day) {
      const rows = await db
        .select({ kind: claims.kind })
        .from(claims)
        .where(and(eq(claims.playerId, playerId), eq(claims.day, day)))
      return rows.map((row) => row.kind as QuestKind)
    },

    async hasVillage(playerId) {
      await catchUp()
      const rows = await db.select().from(villages).where(eq(villages.playerId, playerId))
      return rows.length > 0
    },

    // La clé primaire de claims départage deux réclamations simultanées : la seconde
    // n'insère aucune ligne, et la transaction n'enregistre alors aucun message.
    claim(claim, message) {
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(claims)
          .values(claim)
          .onConflictDoNothing()
          .returning({ kind: claims.kind })
        if (inserted.length === 0) return false
        await enqueue(tx, [message])
        return true
      })
    },

    async removeBefore(day) {
      const removedCounters = await db
        .delete(counters)
        .where(lt(counters.day, day))
        .returning({ day: counters.day })
      const removedClaims = await db
        .delete(claims)
        .where(lt(claims.day, day))
        .returning({ day: claims.day })
      return { counters: removedCounters.length, claims: removedClaims.length }
    },
  }
}
