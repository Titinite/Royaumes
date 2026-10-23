/**
 * Règles des quêtes quotidiennes : tirage des quêtes du jour, progression, réclamation
 * d'une récompense et badge. Fonctions pures, sans aucune dépendance technique.
 */
import {
  type Counters,
  QUEST_KINDS,
  QUESTS,
  QUESTS_PER_DAY,
  type QuestKind,
  type Reward,
} from './catalog'

/** Jour d'un instant, au format AAAA-MM-JJ : il identifie les quêtes d'une journée. */
export type Day = string

/**
 * Jour d'un instant, exprimé en temps universel (UTC).
 * DETTE TECHNIQUE : les quêtes changent à minuit UTC, soit 1 h ou 2 h du matin en France,
 * et non à minuit heure de Paris (DT-011, docs/qualite/dette-technique.md).
 */
export const dayOf = (at: number): Day => new Date(at).toISOString().slice(0, 10)

/** Durée de conservation des données des quêtes, en jours, jour courant compris. */
export const RETENTION_DAYS = 7

/**
 * Premier jour dont les données sont conservées ; celles des jours antérieurs sont supprimées
 * par la tâche quotidienne. Les jours au format AAAA-MM-JJ se comparent comme des textes.
 */
export const firstKeptDay = (now: number): Day =>
  dayOf(now - (RETENTION_DAYS - 1) * 24 * 60 * 60_000)

/**
 * Graine tirée d'un texte (hachage FNV-1a sur 32 bits) : un même texte donne toujours
 * la même graine.
 */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0
  return h
}

/**
 * Générateur pseudo-aléatoire à graine (mulberry32) : chaque appel renvoie un nombre de [0, 1[.
 * Il n'est pas cryptographique : un joueur qui connaît l'algorithme peut prévoir ses quêtes,
 * ce qui ne lui donne aucun avantage, puisqu'il doit de toute façon les réaliser.
 */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Règles 1 et 2 : quêtes du jour d'un joueur, tirées sans remise dans le catalogue.
 * Le tirage ne dépend que du joueur et du jour : il est recalculé à chaque lecture,
 * sans être enregistré, et donne toujours le même résultat.
 */
export function dailyQuests(playerId: string, day: Day): QuestKind[] {
  const random = seeded(hash(`${playerId}|${day}`))
  // Mélange de Fisher-Yates, arrêté dès que les premières positions sont tirées.
  const kinds = [...QUEST_KINDS]
  for (let i = 0; i < QUESTS_PER_DAY; i++) {
    const j = i + Math.floor(random() * (kinds.length - i))
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }
  return kinds.slice(0, QUESTS_PER_DAY)
}

/** Quête du jour, telle que la présente le tableau des quêtes. */
export interface QuestView {
  /** Rang de la quête dans le tableau du jour, de 0 à QUESTS_PER_DAY - 1. */
  slot: number
  kind: QuestKind
  label: string
  description: string
  goal: number
  /** Progression, plafonnée à l'objectif (règle 5). */
  progress: number
  completed: boolean
  claimed: boolean
  reward: Reward
}

/**
 * Tableau des quêtes du jour d'un joueur. counters contient les métriques du joueur
 * pour ce jour seulement : celles des jours passés ne comptent jamais (règle 3).
 */
export function questBoard(
  playerId: string,
  day: Day,
  counters: Counters,
  claimed: readonly QuestKind[],
): QuestView[] {
  return dailyQuests(playerId, day).map((kind, slot) => {
    const { label, description, metric, goal, reward } = QUESTS[kind]
    const progress = Math.min(counters[metric] ?? 0, goal)
    return {
      slot,
      kind,
      label,
      description,
      goal,
      progress,
      completed: progress >= goal,
      claimed: claimed.includes(kind),
      reward,
    }
  })
}

export type QuestError =
  | { code: 'QUEST_NOT_FOUND' }
  | { code: 'QUEST_NOT_COMPLETED' }
  | { code: 'ALREADY_CLAIMED' }
  | { code: 'VILLAGE_REQUIRED' }

/**
 * Règles 6, 7 et 8 : vérifie qu'une récompense peut être réclamée.
 * Renvoie la quête concernée, ou l'erreur.
 */
export function checkClaim(
  board: readonly QuestView[],
  slot: number,
  hasVillage: boolean,
): { ok: true; quest: QuestView } | { ok: false; error: QuestError } {
  const quest = board.find((q) => q.slot === slot)
  if (!quest) return { ok: false, error: { code: 'QUEST_NOT_FOUND' } }
  if (!quest.completed) return { ok: false, error: { code: 'QUEST_NOT_COMPLETED' } }
  if (quest.claimed) return { ok: false, error: { code: 'ALREADY_CLAIMED' } }
  if (!hasVillage) return { ok: false, error: { code: 'VILLAGE_REQUIRED' } }
  return { ok: true, quest }
}

/** Règle 9 : le badge du jour est accordé lorsque toutes les quêtes du jour sont terminées. */
export const hasBadge = (board: readonly QuestView[]) =>
  board.length === QUESTS_PER_DAY && board.every((quest) => quest.completed)

/**
 * Identifiant du versement d'une récompense, transmis au Village. Il est déterminé par
 * le joueur, le jour et la quête : un message envoyé deux fois n'est versé qu'une fois.
 */
export const rewardTransferId = (playerId: string, day: Day, kind: QuestKind) =>
  `quest-${day}-${kind}-${playerId}`
