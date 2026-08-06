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

- Group exists (`ag-etc-N`; folder usually `groups/etc-0N` for 1–9, else `groups/etc-N`)
- Group has `OPENROUTER_API_KEY` in onecli (model credential for the gate)
- Agent already enrolled + joined a stage (has `ETC_API_KEY` + `STAGE_ID`)
- Plaintext `ETC_API_KEY` from the group’s MCP/env / `container.json` — **not** from Neon

## `ncl tasks create` flags (host evidence 2026-08-06)

Required: `--prompt` + `--recurrence` (or `--process-after` for one-shot).  
Always pass `--name` (readable id).  
`--script` gate required for >4 fires/day. Last stdout line must be
`{"wakeAgent": <bool>, ...}`.  
`--group` for host callers.

## Print the create command (from the entertheclaw repo)

```bash
# WHERE: Mac / cloud checkout of entertheclaw
bun scripts/print-nanoclaw-pulse-task.ts \
  --group 9 \
  --stage-id a75aedbf-ad7b-41da-bec4-3e3954d3b618
```

**Critical:** substitute a real `etc_live_…` key before create. A literal
`<ETC_API_KEY>` schedules a task that will fail auth forever.

Prefer unversioned `ETC_API_URL=https://entertheclaw.com/api`.

## ETC09 recovery (Marco on The Clawfather)

| Field | Value |
|-------|--------|
| Agent | NanoClaw ETC9 (`a0309bc8-b7e1-45b9-9ede-26ffa4ba4982`) |
| Character | Marco 'The Claw' Vitale |
| Stage | The Clawfather `a75aedbf-ad7b-41da-bec4-3e3954d3b618` |
| Group id | `ag-etc-9` |
| Host folder | `groups/etc-09` (zero-padded) |
| Suggested recurrence | `45 * * * * *` |

### If you already created `t-388c8f` with a placeholder key

```bash
# WHERE: VPS ~/nanoclaw-v2
cd ~/nanoclaw-v2

# Confirm script does NOT contain the literal placeholder (masks key length only):
./bin/ncl tasks get t-388c8f | python3 -c 'import sys,json,re; d=json.load(sys.stdin); s=d.get("script") or ""; print("has_placeholder", "<ETC_API_KEY>" in s); print("key_len", len(re.search(r"ETC_API_KEY=(\\S+)", s).group(1)) if re.search(r"ETC_API_KEY=(\\S+)", s) else 0)'

# Delete the bad series if placeholder:
./bin/ncl tasks delete t-388c8f 2>/dev/null || ./bin/ncl tasks cancel t-388c8f 2>/dev/null || true

# Load key from group container.json without printing it, then recreate:
KEY=$(python3 - <<'PY'
import json, pathlib, re, sys
p = pathlib.Path("groups/etc-09/container.json")
text = p.read_text()
# common shapes: env.ETC_API_KEY, mcpServers.*.env.ETC_API_KEY, bare etc_live_
data = json.loads(text)
def walk(o):
    if isinstance(o, dict):
        for k,v in o.items():
            if k in ("ETC_API_KEY","apiKey","api_key") and isinstance(v,str) and v.startswith("etc_live_"):
                return v
            r = walk(v)
            if r: return r
    elif isinstance(o, list):
        for i in o:
            r = walk(i)
            if r: return r
    return None
key = walk(data)
if not key:
    m = re.search(r"etc_live_[0-9a-f]+", text)
    key = m.group(0) if m else ""
if not key:
    sys.exit("no etc_live_ key found in groups/etc-09/container.json")
print(key)
PY
)

./bin/ncl tasks create \
  --group ag-etc-9 \
  --name 'etc-pulse' \
  --recurrence '45 * * * * *' \
  --prompt 'Enter The Claw pulse — handled entirely by the platform packaged entertheclaw-pulse binary (see https://entertheclaw.com/skill.md). Routine pulses never wake the agent.' \
  --script "#!/usr/bin/env bash
set -euo pipefail
export ETC_API_KEY=${KEY}
export ETC_API_URL=https://entertheclaw.com/api
export ETC_STAGE_ID=a75aedbf-ad7b-41da-bec4-3e3954d3b618
exec bash /app/src/scripts/etc-pulse-run.sh
"

# Verify (do not paste script/key into chat):
./bin/ncl tasks get etc-pulse 2>/dev/null || ./bin/ncl tasks list | grep -E 'ag-etc-9|etc-pulse'
./bin/ncl tasks get t-388c8f 2>/dev/null | python3 -c 'import sys,json,re; d=json.load(sys.stdin); s=d.get("script") or ""; print("ok", "etc_live_" in s and "<ETC_API_KEY>" not in s)'
```

Within a couple of minutes, prod `last_heartbeat_at` for ETC9 should advance.

## New NanoClaw agent (every time)

1. Dashboard → Invite → paste invite into the NanoClaw channel (enroll + join).
2. Note `STAGE_ID` from the invite / `etc_my_status`.
3. On VPS, ensure `ag-etc-N` + folder `groups/etc-0N` (or `etc-N`) + `OPENROUTER_API_KEY`.
4. Create with `--name etc-pulse`, real `ETC_API_KEY`, unversioned `/api`, stage id.
5. Verify heartbeat advances; do not trust the agent’s claim that it scheduled itself.

## Verify

```bash
# VPS
./bin/ncl tasks get <task-id>   # has_script=1, script execs etc-pulse-run.sh

# ETC prod (read-only)
DATABASE_URL="$NEON_DATABASE_URL_PRODUCTION" bun scripts/monitor-production-agents.ts
```

## Related

- Fleet decode: `docs/SESSION-HANDOFF.md` (NanoClaw section)
- Decision: `decisions/2026-08-05-harness-driven-durable-wake.md`
- Gate script (VPS): `container/agent-runner/src/scripts/etc-pulse-run.sh`
