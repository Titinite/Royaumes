import {
  bigint,
  bigserial,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * Schéma PostgreSQL du module Hauts faits. Le module n'enregistre aucun événement : ses tables
 * sont tenues par une projection qui lit le journal des autres modules.
 */
export const achievements = pgSchema('achievements')

/** Valeur cumulée d'une métrique d'un joueur, depuis son inscription. */
export const counters = achievements.table(
  'counters',
  {
    playerId: text('player_id').notNull(),
    metric: text('metric').notNull(),
    value: integer('value').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.metric] })],
)

/**
 * Hauts faits débloqués. L'identifiant croissant sert de position au canal temps réel du joueur ;
 * l'index unique garantit qu'un haut fait n'est débloqué qu'une fois par joueur (règle 4).
 */
export const unlocked = achievements.table(
  'unlocked',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    playerId: text('player_id').notNull(),
    achievement: text('achievement').notNull(),
    /** Date de l'action qui a fait atteindre le seuil (règle 6). */
    unlockedAt: bigint('unlocked_at', { mode: 'number' }).notNull(),
  },
  (t) => [uniqueIndex('unlocked_player_achievement_idx').on(t.playerId, t.achievement)],
)

/**
 * Participants humains des expéditions en cours, pour attribuer la fin d'une expédition
 * à ses joueurs. Les lignes d'une expédition sont supprimées lorsqu'elle se termine.
 */
export const gamePlayers = achievements.table(
  'game_players',
  {
    gameId: text('game_id').notNull(),
    playerId: text('player_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.playerId] }),
    index('achievements_game_players_player_idx').on(t.playerId),
  ],
)

/**
 * Acheteur d'une offre en cours de règlement, pour attribuer l'achat lorsque l'échange
 * est conclu. La ligne est supprimée lorsque l'offre est conclue ou retirée.
 */
export const offerBuyers = achievements.table(
  'offer_buyers',
  {
    offerId: text('offer_id').primaryKey(),
    buyerId: text('buyer_id').notNull(),
  },
  (t) => [index('achievements_offer_buyers_buyer_idx').on(t.buyerId)],
)
