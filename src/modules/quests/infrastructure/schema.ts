import { bigint, index, integer, pgSchema, primaryKey, text } from 'drizzle-orm/pg-core'

/**
 * Schéma PostgreSQL du module Quêtes. Le module n'enregistre aucun événement : ses tables
 * sont tenues par une projection qui lit le journal des autres modules (counters, villages,
 * game_players, offer_buyers), et par la réclamation des récompenses (claims).
 */
export const quests = pgSchema('quests')

/**
 * Valeur d'une métrique d'un joueur pour un jour (AAAA-MM-JJ, UTC). Les lignes des jours
 * passés ne servent plus : elles sont supprimées par la tâche quotidienne.
 */
export const counters = quests.table(
  'counters',
  {
    playerId: text('player_id').notNull(),
    day: text('day').notNull(),
    metric: text('metric').notNull(),
    value: integer('value').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.playerId, t.day, t.metric] }),
    // La tâche quotidienne supprime les jours les plus anciens.
    index('counters_day_idx').on(t.day),
  ],
)

/**
 * Récompenses réclamées. La clé primaire garantit qu'une quête d'un jour n'est réclamée
 * qu'une seule fois par joueur, même si deux réclamations sont simultanées (règle 7).
 */
export const claims = quests.table(
  'claims',
  {
    playerId: text('player_id').notNull(),
    day: text('day').notNull(),
    kind: text('kind').notNull(),
    claimedAt: bigint('claimed_at', { mode: 'number' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.day, t.kind] }), index('claims_day_idx').on(t.day)],
)

/** Joueurs qui ont fondé leur village : seuls ceux-là peuvent réclamer une récompense (règle 8). */
export const villages = quests.table('villages', {
  playerId: text('player_id').primaryKey(),
})

/**
 * Participants humains des expéditions en cours, pour attribuer la fin d'une expédition
 * à ses joueurs. Les lignes d'une expédition sont supprimées lorsqu'elle se termine.
 */
export const gamePlayers = quests.table(
  'game_players',
  {
    gameId: text('game_id').notNull(),
    playerId: text('player_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.playerId] }),
    index('game_players_player_idx').on(t.playerId),
  ],
)

/**
 * Acheteur d'une offre en cours de règlement, pour attribuer l'achat lorsque l'échange
 * est conclu. La ligne est supprimée lorsque l'offre est conclue ou retirée.
 */
export const offerBuyers = quests.table(
  'offer_buyers',
  {
    offerId: text('offer_id').primaryKey(),
    buyerId: text('buyer_id').notNull(),
  },
  (t) => [index('offer_buyers_buyer_idx').on(t.buyerId)],
)
