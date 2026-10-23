/**
 * Règles des hauts faits : déblocage au franchissement d'un seuil, et présentation du
 * catalogue avec la progression d'un joueur. Fonctions pures, sans dépendance technique.
 */
import { ACHIEVEMENT_IDS, ACHIEVEMENTS, type AchievementId, type Counters } from './catalog'

/**
 * Règles 3 à 5 : hauts faits débloqués par une évolution des métriques d'un joueur.
 * Un haut fait est débloqué lorsque sa métrique franchit son seuil : il ne l'est donc qu'une
 * fois, au moment du franchissement, et une même évolution peut en débloquer plusieurs.
 */
export function unlockedBy(before: Counters, after: Counters): AchievementId[] {
  return ACHIEVEMENT_IDS.filter((id) => {
    const { metric, threshold } = ACHIEVEMENTS[id]
    return (before[metric] ?? 0) < threshold && (after[metric] ?? 0) >= threshold
  })
}

/** Haut fait, tel que le présente le catalogue à un joueur. */
export interface AchievementView {
  id: AchievementId
  label: string
  description: string
  threshold: number
  /** Progression du joueur, plafonnée au seuil. */
  progress: number
  /** Date d'obtention, en millisecondes ; null si le haut fait n'est pas débloqué. */
  unlockedAt: number | null
}

/** Catalogue des hauts faits, avec la progression d'un joueur. */
export interface AchievementBoard {
  unlockedCount: number
  total: number
  achievements: AchievementView[]
}

/**
 * Règle 1 : le catalogue complet, hauts faits non débloqués compris, avec la progression
 * du joueur. unlocked associe à chaque haut fait débloqué sa date d'obtention.
 */
export function achievementBoard(
  counters: Counters,
  unlocked: Partial<Record<AchievementId, number>>,
): AchievementBoard {
  const achievements = ACHIEVEMENT_IDS.map((id) => {
    const { label, description, metric, threshold } = ACHIEVEMENTS[id]
    return {
      id,
      label,
      description,
      threshold,
      progress: Math.min(counters[metric] ?? 0, threshold),
      unlockedAt: unlocked[id] ?? null,
    }
  })
  return {
    unlockedCount: achievements.filter((a) => a.unlockedAt !== null).length,
    total: achievements.length,
    achievements,
  }
}
