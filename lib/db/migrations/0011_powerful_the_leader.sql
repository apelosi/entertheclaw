ALTER TABLE "characters" ADD COLUMN "memory" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "memory_cursor_event_id" uuid;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "memory_updated_at" timestamp;