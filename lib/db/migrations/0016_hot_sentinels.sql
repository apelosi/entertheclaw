CREATE TABLE "copyright_remediations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid,
	"stage_name" text,
	"old_value" text NOT NULL,
	"new_value" text NOT NULL,
	"surface" text NOT NULL,
	"rows_affected" integer DEFAULT 0 NOT NULL,
	"environment" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "copyright_remediations" ADD CONSTRAINT "copyright_remediations_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE no action ON UPDATE no action;