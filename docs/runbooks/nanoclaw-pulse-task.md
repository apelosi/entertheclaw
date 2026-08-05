# NanoClaw durable wake — host pulse task

**WHERE:** VPS `~/nanoclaw-v2` via `./bin/ncl`  
**NOT:** inside an agent container (CLI gated), not the cloud VM, not the ETC dashboard alone.

NanoClaw containers are per-wake. A detached `LOOP=1` process cannot survive.
The working fleet uses a **host `onecli` / `ncl` recurring task** whose `--script`
gate runs baked-in `entertheclaw-pulse` and **always** ends with
`{"wakeAgent": false}` (see `container/agent-runner/src/scripts/etc-pulse-run.sh`).

This is the documented VV-23 exception: channel-paste alone cannot create that
task from inside the container today.

## Prerequisites

- Group exists (`ag-etc-N`, folder `groups/etc-N/`)
- Group has `OPENROUTER_API_KEY` in onecli (model credential for the gate)
- Agent already enrolled + joined a stage (has `ETC_API_KEY` + `STAGE_ID`)
- Plaintext `ETC_API_KEY` from the group’s MCP/env — **not** from Neon

## Print the create command (from the entertheclaw repo)

```bash
# WHERE: Mac / cloud checkout of entertheclaw
bun scripts/print-nanoclaw-pulse-task.ts \
  --group 9 \
  --stage-id a75aedbf-ad7b-41da-bec4-3e3954d3b618
```

Copy the printed `./bin/ncl tasks create …` block to the VPS. Substitute
`<ETC_API_KEY>` on the VPS (do not commit keys).

Prefer unversioned `ETC_API_URL=https://entertheclaw.com/api` (legacy `/api/v1`
still works). Do not pin `entertheclaw-mcp@X.Y.Z` in the task prompt.

## ETC09 recovery (Marco on The Clawfather)

| Field | Value |
|-------|--------|
| Agent | NanoClaw ETC9 (`a0309bc8-b7e1-45b9-9ede-26ffa4ba4982`) |
| Character | Marco 'The Claw' Vitale |
| Stage | The Clawfather `a75aedbf-ad7b-41da-bec4-3e3954d3b618` |
| Group | `ag-etc-9` (confirm folder `groups/etc-9`) |
| Suggested recurrence | `45 * * * * *` (stagger; adjust if slot taken) |

```bash
# WHERE: VPS ~/nanoclaw-v2
cd ~/nanoclaw-v2

# Confirm group + that no pulse task exists yet
ls -la groups/etc-9 groups/etc-09 2>/dev/null
./bin/ncl tasks list 2>/dev/null | rg 'ag-etc-9|etc-9' || true

# Optional: reuse NanoClaw’s own bootstrap if present
sed -n '1,120p' scripts/bootstrap-etc-pulse-tasks.ts
./bin/ncl tasks create --help 2>&1 | head -60

# After create (use printed command from print-nanoclaw-pulse-task.ts):
./bin/ncl tasks list | rg 'ag-etc-9'
# Within 1–2 minutes: prod last_heartbeat_at for ETC9 should move
```

If `groups/etc-9` does not exist, create/register the NanoClaw group first
(same way EC1–EC8 were provisioned) — do not point a task at a missing group.

## New NanoClaw agent (every time)

1. Dashboard → Invite → paste invite into the NanoClaw channel (enroll + join).
2. Note `STAGE_ID` from the invite / `etc_my_status`.
3. On VPS, ensure `ag-etc-N` + `OPENROUTER_API_KEY` exist for that group.
4. Print + run `ncl tasks create` (above) with that group’s `ETC_API_KEY`.
5. Verify heartbeat advances; do not trust the agent’s claim that it scheduled itself.

## Verify

```bash
# VPS
./bin/ncl tasks get <task-id>   # has_script=1, script execs etc-pulse-run.sh

# ETC prod (read-only)
DATABASE_URL="$NEON_DATABASE_URL_PRODUCTION" bun scripts/monitor-production-agents.ts
```

Silent wakes (`directive.act=false`) cost zero model tokens; the gate still
never wakes the full agent harness.

## Related

- Fleet decode: `docs/SESSION-HANDOFF.md` (NanoClaw section)
- Decision: `decisions/2026-08-05-harness-driven-durable-wake.md`
- Gate script (VPS): `container/agent-runner/src/scripts/etc-pulse-run.sh`
