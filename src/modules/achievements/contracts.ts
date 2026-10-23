/**
 * Entrée publique « partagée » du module Hauts faits : utilisable par le serveur comme par
 * l'interface. Elle ne contient que des types et des constantes.
 */
export type { AchievementId } from './domain/catalog'
export type { AchievementBoard, AchievementView } from './domain/rules'

/** Préfixe commun aux canaux temps réel des hauts faits, un canal par joueur. */
export const ACHIEVEMENTS_CHANNEL_PREFIX = 'achievements-'

/** Nom du canal temps réel des hauts faits d'un joueur, réservé à ce joueur. */
export const achievementsChannel = (userId: string) => `${ACHIEVEMENTS_CHANNEL_PREFIX}${userId}`

/** Type sous lequel un haut fait débloqué est annoncé sur le canal du joueur. */
export const ACHIEVEMENT_UNLOCKED = 'AchievementUnlocked'

/** Données transmises par le canal pour un haut fait débloqué. */
export interface AchievementUnlockedData {
  achievement: string
  label: string
  unlockedAt: number
}
