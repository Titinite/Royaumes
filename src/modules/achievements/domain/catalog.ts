/**
 * Catalogue des hauts faits. Chaque haut fait mesure une seule grandeur cumulée depuis
 * l'inscription du joueur (une « métrique »), et fixe le seuil qui le débloque.
 */

/** Grandeurs cumulées pour chaque joueur, alimentées par ses actions dans les autres modules. */
export const METRICS = [
  'villagesFounded',
  'upgrades',
  'gamesPlayed',
  'gamesWon',
  'gold',
  'gamesJoined',
  'offersPublished',
  'purchases',
] as const
export type Metric = (typeof METRICS)[number]

/** Valeur des métriques d'un joueur ; une métrique absente vaut 0. */
export type Counters = Partial<Record<Metric, number>>

export interface AchievementDefinition {
  label: string
  description: string
  metric: Metric
  /** Valeur de la métrique qui débloque le haut fait, strictement positive. */
  threshold: number
}

/** Identifiants des hauts faits, dans l'ordre du catalogue. */
export const ACHIEVEMENT_IDS = [
  'first-steps',
  'builder-bronze',
  'builder-silver',
  'builder-gold',
  'adventurer',
  'slayer-bronze',
  'slayer-silver',
  'slayer-gold',
  'fortunate',
  'brother-in-arms',
  'merchant',
  'loyal-customer',
] as const
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number]

export const ACHIEVEMENTS: Record<AchievementId, AchievementDefinition> = {
  'first-steps': {
    label: 'Premier pas',
    description: 'Fonder son village',
    metric: 'villagesFounded',
    threshold: 1,
  },
  'builder-bronze': {
    label: 'Bâtisseur (bronze)',
    description: 'Effectuer 5 améliorations',
    metric: 'upgrades',
    threshold: 5,
  },
  'builder-silver': {
    label: 'Bâtisseur (argent)',
    description: 'Effectuer 15 améliorations',
    metric: 'upgrades',
    threshold: 15,
  },
  'builder-gold': {
    label: 'Bâtisseur (or)',
    description: 'Effectuer 30 améliorations',
    metric: 'upgrades',
    threshold: 30,
  },
  adventurer: {
    label: 'Aventurier',
    description: 'Terminer une expédition',
    metric: 'gamesPlayed',
    threshold: 1,
  },
  'slayer-bronze': {
    label: 'Pourfendeur (bronze)',
    description: 'Gagner une expédition',
    metric: 'gamesWon',
    threshold: 1,
  },
  'slayer-silver': {
    label: 'Pourfendeur (argent)',
    description: 'Gagner 10 expéditions',
    metric: 'gamesWon',
    threshold: 10,
  },
  'slayer-gold': {
    label: 'Pourfendeur (or)',
    description: 'Gagner 25 expéditions',
    metric: 'gamesWon',
    threshold: 25,
  },
  fortunate: {
    label: 'Fortuné',
    description: "Rapporter 500 pièces d'or des expéditions",
    metric: 'gold',
    threshold: 500,
  },
  'brother-in-arms': {
    label: "Compagnon d'armes",
    description: "Rejoindre 3 expéditions d'autres joueurs",
    metric: 'gamesJoined',
    threshold: 3,
  },
  merchant: {
    label: 'Marchand',
    description: 'Publier 5 offres au Marché',
    metric: 'offersPublished',
    threshold: 5,
  },
  'loyal-customer': {
    label: 'Client fidèle',
    description: 'Conclure 5 achats au Marché',
    metric: 'purchases',
    threshold: 5,
  },
}
