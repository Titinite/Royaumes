CREATE SCHEMA "quests";
--> statement-breakpoint
CREATE TABLE "quests"."claims" (
	"player_id" text NOT NULL,
	"day" text NOT NULL,
	"kind" text NOT NULL,
	"claimed_at" bigint NOT NULL,
	CONSTRAINT "claims_player_id_day_kind_pk" PRIMARY KEY("player_id","day","kind")
);
--> statement-breakpoint
CREATE TABLE "quests"."counters" (
	"player_id" text NOT NULL,
	"day" text NOT NULL,
	"metric" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "counters_player_id_day_metric_pk" PRIMARY KEY("player_id","day","metric")
);
--> statement-breakpoint
CREATE TABLE "quests"."game_players" (
	"game_id" text NOT NULL,
	"player_id" text NOT NULL,
	CONSTRAINT "game_players_game_id_player_id_pk" PRIMARY KEY("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "quests"."offer_buyers" (
	"offer_id" text PRIMARY KEY NOT NULL,
	"buyer_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quests"."villages" (
	"player_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE INDEX "claims_day_idx" ON "quests"."claims" USING btree ("day");--> statement-breakpoint
CREATE INDEX "counters_day_idx" ON "quests"."counters" USING btree ("day");--> statement-breakpoint
CREATE INDEX "game_players_player_idx" ON "quests"."game_players" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "offer_buyers_buyer_idx" ON "quests"."offer_buyers" USING btree ("buyer_id");