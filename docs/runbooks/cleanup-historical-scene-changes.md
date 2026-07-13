# Historical scene_change cleanup

One-time correction for overzealous `scene_change` rows created before PR #80 (current-scene gate + invariants).

## Affected stages (as of latest production preview)

| Stage | Delete | Keep |
|-------|--------|------|
| **Claw Wars** | 2 duplicate vent-grate rows | Opening cantina, Outside cantina, first vent grate, Ossus archives (if present) |
| **The Clawfather** | Wedding duplicate + shooting duplicates (2–3 rows) | Opening wedding study, first "seconds after shooting" |
| **Claw of the Titans** | Vault rephrase (hatch opened in same bronze chamber) | Oracle steps, bronze chamber, dark shaft descent |

## Preview (no DB writes)

```bash
bun run db:preview-historical-scenes
```

## Apply (production DB)

**Requires production Neon branch** (`ep-muddy-wave`), not dev (`ep-polished-paper`).

Bun loads env files natively — no `dotenv` CLI required:

```bash
# Dry run
bun --env-file=.env.production.local run db:cleanup-historical-scenes -- --dry-run

# Apply deletes + hospital backfill
bun --env-file=.env.production.local run db:cleanup-historical-scenes -- --yes
```

Shorthand scripts (same thing):

```bash
bun run db:cleanup-historical-scenes:prod:dry-run
bun run db:cleanup-historical-scenes:prod
```

Or pass an explicit URL:

```bash
bun run db:cleanup-historical-scenes -- --database-url='postgresql://...' --dry-run
bun run db:cleanup-historical-scenes -- --database-url='postgresql://...' --yes
```

## Backfill

The Clawfather hospital corridor (`[The hospital corridor is fluorescent…]`) never received a `scene_change` under the old classifier. The cleanup script inserts one row timestamped 1s after the source dialogue when none exists.

## Logic

Uses `lib/stage/evaluate-historical-scene-change.ts`:

1. `shouldRunSceneClassifier` with current scene name (gate would skip?)
2. `enforceSceneChangeInvariant` (identical name / contradictory reason?)
3. Historical-only: `scenesAreSameLocation` for rephrased same spot
4. Titans hatch-open-in-same-chamber rule
