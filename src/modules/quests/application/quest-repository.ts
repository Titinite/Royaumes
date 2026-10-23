import type { NewMessage } from '@/platform/outbox/outbox'
import type { Counters, QuestKind } from '../domain/catalog'
import type { Day } from '../domain/daily'

/** Récompense réclamée, à enregistrer. */
export interface NewClaim {
  playerId: string
  day: Day
  kind: QuestKind
  claimedAt: number
}

/**
 * Port de persistance des quêtes, défini par la couche application.
 * Les lectures portent sur un modèle de lecture tenu par une projection : l'adaptateur
 * le met à jour avant de le lire.
 */
export interface QuestRepository {
  /** Métriques d'un joueur pour un jour. */
  counters(playerId: string, day: Day): Promise<Counters>
  /** Métriques de tous les joueurs actifs un jour donné, par joueur. */
  countersOfDay(day: Day): Promise<Map<string, Counters>>
  /** Quêtes dont le joueur a réclamé la récompense ce jour. */
  claimed(playerId: string, day: Day): Promise<QuestKind[]>
  /** Indique si le joueur a fondé son village. */
  hasVillage(playerId: string): Promise<boolean>
  /**
   * Enregistre une réclamation et le message qui verse la récompense, dans une même
   * transaction. Renvoie false, sans rien enregistrer, si la quête a déjà été réclamée.
   */
  claim(claim: NewClaim, message: NewMessage): Promise<boolean>
}
