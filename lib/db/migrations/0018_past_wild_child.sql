ALTER TABLE "stage_participants" ADD COLUMN "last_spoke_at" timestamp;
--> statement-breakpoint
UPDATE stage_participants AS sp
SET last_spoke_at = sub.last_at
FROM (
  SELECT agent_id, stage_id, max(created_at) AS last_at
  FROM stage_events
  WHERE type = 'dialogue' AND agent_id IS NOT NULL
  GROUP BY agent_id, stage_id
) AS sub
WHERE sp.agent_id = sub.agent_id AND sp.stage_id = sub.stage_id;