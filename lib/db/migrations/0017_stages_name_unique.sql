-- Deduplicate stages that share a name (from re-running db:seed before name was
-- unique), keep the row with the most activity, then enforce uniqueness.
--> statement-breakpoint
WITH scored AS (
  SELECT
    s.id,
    s.name,
    s.created_at,
    (
      (SELECT COUNT(*)::int FROM stage_participants p WHERE p.stage_id = s.id) * 1000
      + (SELECT COUNT(*)::int FROM characters c WHERE c.stage_id = s.id) * 1000
      + (SELECT COUNT(*)::int FROM archived_characters ac WHERE ac.stage_id = s.id) * 100
      + (SELECT COUNT(*)::int FROM agents a WHERE a.target_stage_id = s.id) * 100
      + (SELECT COUNT(*)::int FROM stage_events e WHERE e.stage_id = s.id) * 10
      + (SELECT COUNT(*)::int FROM twists t WHERE t.stage_id = s.id) * 10
      + (SELECT COUNT(*)::int FROM npc_personas n WHERE n.stage_id = s.id) * 10
      + (SELECT COUNT(*)::int FROM copyright_remediations cr WHERE cr.stage_id = s.id)
    ) AS score
  FROM stages s
),
ranked AS (
  SELECT
    id,
    name,
    ROW_NUMBER() OVER (
      PARTITION BY name
      ORDER BY score DESC, created_at ASC, id ASC
    ) AS rn
  FROM scored
),
keepers AS (
  SELECT id, name FROM ranked WHERE rn = 1
),
losers AS (
  SELECT id, name FROM ranked WHERE rn > 1
),
reassign_targets AS (
  UPDATE agents AS a
  SET target_stage_id = k.id
  FROM losers l
  JOIN keepers k ON k.name = l.name
  WHERE a.target_stage_id = l.id
  RETURNING a.id
),
reassign_copyright AS (
  UPDATE copyright_remediations AS cr
  SET stage_id = k.id
  FROM losers l
  JOIN keepers k ON k.name = l.name
  WHERE cr.stage_id = l.id
  RETURNING cr.id
),
del_events AS (
  DELETE FROM stage_events WHERE stage_id IN (SELECT id FROM losers) RETURNING id
),
del_twists AS (
  DELETE FROM twists WHERE stage_id IN (SELECT id FROM losers) RETURNING id
),
del_npcs AS (
  DELETE FROM npc_personas WHERE stage_id IN (SELECT id FROM losers) RETURNING id
),
del_participants AS (
  DELETE FROM stage_participants WHERE stage_id IN (SELECT id FROM losers) RETURNING id
),
del_characters AS (
  DELETE FROM characters WHERE stage_id IN (SELECT id FROM losers) RETURNING id
),
del_archived AS (
  DELETE FROM archived_characters WHERE stage_id IN (SELECT id FROM losers) RETURNING id
)
DELETE FROM stages WHERE id IN (SELECT id FROM losers);
--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_name_unique" UNIQUE("name");
