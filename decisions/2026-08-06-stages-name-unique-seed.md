## Decision: Enforce unique `stages.name` and seed on conflict by name

## Context: Neon DEV showed two of every stage (40 rows / 20 names) in the invite picker. Root cause: `lib/db/seed.ts` used `.onConflictDoNothing()` without a conflict target while inserting new UUIDs each run, and `stages.name` had no unique constraint — so every `db:seed` / `db:bootstrap-branch` inserted another full set of 20.

## Alternatives considered: (1) Soft-fix only in DEV with a one-off script and leave seed as-is. (2) Make seed “SELECT then INSERT if missing” without a DB constraint. (3) Unique on name + `onConflictDoNothing({ target: stages.name })`, with a migration that dedupes existing rows first.

## Reasoning: Option 3 fixes current data on migrate and makes re-seed / re-bootstrap idempotent at the database level. Application-only checks still allow races and forgetful scripts (`reset-stages` truncates first; seed alone does not).

## Trade-offs accepted: Stage display names must be globally unique (including future user-created stages). Dedupe keeps the highest-activity row per name and deletes dependents on losers (reassigns `agents.target_stage_id` and `copyright_remediations.stage_id`).
