# Historical scene_change cleanup

One-time correction for overzealous `scene_change` rows created before PR #80 (current-scene gate + invariants).

## Affected stages

| Stage | Delete | Keep |
|-------|--------|------|
| **Claw Wars** | 2 duplicate vent-grate rows | Opening cantina, Outside cantina, first vent grate |
| **The Clawfather** | Wedding duplicate + shooting duplicate | Opening wedding study, first "seconds after shooting" |
| **Claw of the Titans** | Vault rephrase (hatch opened in same bronze chamber) | Oracle steps, bronze chamber, dark shaft descent |

## Preview (no DB writes)

Against production feed via public API:

```bash
bunx tsx scripts/preview-historical-scene-cleanup.ts
```

## Apply (production DB)

**Requires production Neon branch** (`ep-muddy-wave`), not dev (`ep-polished-paper`).

```bash
# Dry run
dotenv -e .env.production.local -- bun run db:cleanup-historical-scenes -- --dry-run

# Apply deletes + hospital backfill
dotenv -e .env.production.local -- bun run db:cleanup-historical-scenes -- --yes
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
