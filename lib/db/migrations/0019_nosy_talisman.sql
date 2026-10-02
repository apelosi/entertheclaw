CREATE TABLE "stage_turn_locks" (
	"stage_id" uuid PRIMARY KEY NOT NULL,
	"agent_id" uuid NOT NULL,
	"claim_id" text NOT NULL,
	"granted_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stage_turn_locks" ADD CONSTRAINT "stage_turn_locks_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_turn_locks" ADD CONSTRAINT "stage_turn_locks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;