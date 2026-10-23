CREATE SCHEMA "achievements";
--> statement-breakpoint
CREATE TABLE "achievements"."counters" (
	"player_id" text NOT NULL,
	"metric" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "counters_player_id_metric_pk" PRIMARY KEY("player_id","metric")
);
--> statement-breakpoint
CREATE TABLE "achievements"."game_players" (
	"game_id" text NOT NULL,
	"player_id" text NOT NULL,
	CONSTRAINT "game_players_game_id_player_id_pk" PRIMARY KEY("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "achievements"."offer_buyers" (
	"offer_id" text PRIMARY KEY NOT NULL,
	"buyer_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "achievements"."unlocked" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"player_id" text NOT NULL,
	"achievement" text NOT NULL,
	"unlocked_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "achievements_game_players_player_idx" ON "achievements"."game_players" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "achievements_offer_buyers_buyer_idx" ON "achievements"."offer_buyers" USING btree ("buyer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unlocked_player_achievement_idx" ON "achievements"."unlocked" USING btree ("player_id","achievement");