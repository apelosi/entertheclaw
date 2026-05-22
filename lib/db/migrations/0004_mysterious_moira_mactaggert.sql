ALTER TYPE "public"."stage_event_type" ADD VALUE 'character_ready';--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "portrait_bytes" "bytea";--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "sprite_bytes" "bytea";--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "assets_version" integer DEFAULT 0 NOT NULL;