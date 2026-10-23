/**
 * Entrée publique « partagée » du module Quêtes : utilisable par le serveur comme par
 * l'interface. Elle ne contient que des types, des constantes et des schémas de validation.
 */
import { z } from 'zod'
import { QUESTS_PER_DAY } from './domain/catalog'
import type { QuestView } from './domain/daily'

export type { QuestKind, Reward } from './domain/catalog'
export { QUESTS_PER_DAY } from './domain/catalog'
export type { QuestError, QuestView } from './domain/daily'

/** Tableau des quêtes du jour d'un joueur, renvoyé par l'API. */
export interface QuestBoard {
  /** Jour des quêtes, au format AAAA-MM-JJ (UTC). */
  day: string
  quests: QuestView[]
  /** Vrai si les quatre quêtes du jour sont terminées (règle 9). */
  badge: boolean
}

/** Paramètre de la réclamation : le rang de la quête dans le tableau du jour. */
export const ClaimParams = z.object({
  slot: z.coerce
    .number()
    .int('Le rang de la quête doit être un entier')
    .min(0, 'Rang de quête invalide')
    .max(QUESTS_PER_DAY - 1, 'Rang de quête invalide'),
})
