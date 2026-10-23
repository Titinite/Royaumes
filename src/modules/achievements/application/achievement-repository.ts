import type { AchievementId, Counters } from '../domain/catalog'

/** Haut fait débloqué, tel qu'il est enregistré. */
export interface UnlockedAchievement {
  /** Identifiant croissant : il sert de position au canal temps réel du joueur. */
  id: number
  achievement: AchievementId
  unlockedAt: number
}

/**
 * Port de persistance des hauts faits, défini par la couche application.
 * Les lectures portent sur un modèle de lecture tenu par une projection : l'adaptateur
 * le met à jour avant de le lire.
 */
export interface AchievementRepository {
  /** Métriques cumulées d'un joueur. */
  counters(playerId: string): Promise<Counters>
  /** Hauts faits débloqués par un joueur, après une position, dans l'ordre de leur déblocage. */
  unlockedAfter(playerId: string, after: number): Promise<UnlockedAchievement[]>
  /** Position du dernier haut fait débloqué par un joueur ; 0 s'il n'en a aucun. */
  lastPosition(playerId: string): Promise<number>
}
