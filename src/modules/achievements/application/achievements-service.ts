import { ACHIEVEMENTS, type AchievementId } from '../domain/catalog'
import { type AchievementBoard, achievementBoard } from '../domain/rules'
import type { AchievementRepository } from './achievement-repository'

/** Haut fait débloqué, tel que l'annonce le canal temps réel du joueur. */
export interface Unlocked {
  position: number
  achievement: AchievementId
  label: string
  unlockedAt: number
}

/** Service applicatif des Hauts faits : uniquement des lectures. */
export function createAchievementsService(repo: AchievementRepository) {
  /** Catalogue des hauts faits, avec la progression et les déblocages du joueur (règle 1). */
  async function board(playerId: string): Promise<AchievementBoard> {
    const [counters, unlocked] = await Promise.all([
      repo.counters(playerId),
      repo.unlockedAfter(playerId, 0),
    ])
    const dates = Object.fromEntries(unlocked.map((u) => [u.achievement, u.unlockedAt]))
    return achievementBoard(counters, dates)
  }

  /** Hauts faits débloqués par le joueur après une position du canal. */
  async function unlockedSince(playerId: string, after: number): Promise<Unlocked[]> {
    const rows = await repo.unlockedAfter(playerId, after)
    return rows.map((row) => ({
      position: row.id,
      achievement: row.achievement,
      label: ACHIEVEMENTS[row.achievement].label,
      unlockedAt: row.unlockedAt,
    }))
  }

  /** Position de départ du canal d'un joueur : seuls les déblocages à venir sont annoncés. */
  const lastPosition = (playerId: string) => repo.lastPosition(playerId)

  return { board, unlockedSince, lastPosition }
}

export type AchievementsService = ReturnType<typeof createAchievementsService>
