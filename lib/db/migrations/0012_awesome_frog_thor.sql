ALTER TABLE "archived_characters" ADD COLUMN "portrait_bytes" "bytea";--> statement-breakpoint
ALTER TABLE "archived_characters" ADD COLUMN "sprite_bytes" "bytea";--> statement-breakpoint
ALTER TABLE "archived_characters" ADD COLUMN "assets_version" integer;