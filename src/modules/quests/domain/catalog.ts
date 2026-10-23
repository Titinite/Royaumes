/**
 * Catalogue des quêtes quotidiennes. Chaque quête mesure une seule grandeur (une « métrique »),
 * alimentée par les actions du joueur dans les autres modules, et fixe un objectif à atteindre.
 */

/** Grandeurs mesurées chaque jour pour chaque joueur. */
export const METRICS = [
  'upgrades',
  'gamesPlayed',
  'gamesWon',
  'gamesJoined',
  'offersPublished',
  'purchases',
] as const
export type Metric = (typeof METRICS)[number]

/** Valeur des métriques d'un joueur pour un jour : une métrique absente vaut 0. */
export type Counters = Partial<Record<Metric, number>>

/**
 * Ressources qu'une quête peut rapporter.
 * Ce sont celles qu'accepte un versement au Village : le blé n'en fait pas partie.
 */
export type Reward = Partial<Record<'wood' | 'stone' | 'gold', number>>

export interface QuestDefinition {
  label: string
  description: string
  metric: Metric
  /** Valeur de la métrique à atteindre, strictement positive. */
  goal: number
  reward: Reward
}

/** Types de quêtes, dans l'ordre du catalogue. */
export const QUEST_KINDS = [
  'builder',
  'master-builder',
  'adventurer',
  'victor',
  'brother-in-arms',
  'merchant',
  'buyer',
  'veteran',
] as const
export type QuestKind = (typeof QUEST_KINDS)[number]

export const QUESTS: Record<QuestKind, QuestDefinition> = {
  builder: {
    label: 'Bâtisseur',
    description: 'Améliorer un bâtiment du village',
    metric: 'upgrades',
    goal: 1,
    reward: { wood: 50 },
  },
  'master-builder': {
    label: 'Grand bâtisseur',
    description: 'Améliorer deux bâtiments du village',
    metric: 'upgrades',
    goal: 2,
    reward: { stone: 40 },
  },
  adventurer: {
    label: 'Aventurier',
    description: 'Terminer une expédition',
    metric: 'gamesPlayed',
    goal: 1,
    reward: { wood: 50 },
  },
  victor: {
    label: 'Vainqueur',
    description: 'Gagner une expédition',
    metric: 'gamesWon',
    goal: 1,
    reward: { gold: 20 },
  },
  'brother-in-arms': {
    label: "Compagnon d'armes",
    description: "Rejoindre l'expédition d'un autre joueur",
    metric: 'gamesJoined',
    goal: 1,
    reward: { stone: 40 },
  },
  merchant: {
    label: 'Marchand',
    description: 'Publier une offre au Marché',
    metric: 'offersPublished',
    goal: 1,
    reward: { stone: 30 },
  },
  buyer: {
    label: 'Acheteur',
    description: 'Conclure un achat au Marché',
    metric: 'purchases',
    goal: 1,
    reward: { gold: 15 },
  },
  veteran: {
    label: 'Vétéran',
    description: 'Terminer trois expéditions',
    metric: 'gamesPlayed',
    goal: 3,
    reward: { gold: 30 },
  },
}

/** Nombre de quêtes proposées chaque jour à un joueur. */
export const QUESTS_PER_DAY = 4
