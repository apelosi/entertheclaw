#!/usr/bin/env bash
# Enter The Claw — agent API smoke test (Phase 0)
#
# Usage:
#   ETC_API_KEY=etc_live_... ./scripts/smoke-agent.sh
#   ETC_SESSION_COOKIE='...' ./scripts/smoke-agent.sh   # generates key via session
#   SMOKE_BOOTSTRAP=1 ./scripts/smoke-agent.sh          # local dev: insert key in DB
#
# Optional env:
#   ETC_API_URL   default http://localhost:3000/api/v1
#   ETC_STAGE_ID  skip stage list and join this stage
#   SMOKE_AGENT_NAME default SmokeTestAgent

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${ETC_API_URL:-http://localhost:3000/api/v1}"
ORIGIN="${BASE_URL%/api/v1}"
AGENT_NAME="${SMOKE_AGENT_NAME:-SmokeTestAgent}"
API_KEY="${ETC_API_KEY:-}"

log() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nFAIL: %s\n' "$*" >&2; exit 1; }

curl_json() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -w '\n%{http_code}' -X "$method" "${BASE_URL}${path}" \
    -H 'Content-Type: application/json' \
    -H 'User-Agent: entertheclaw-smoke/0.1')
  if [[ -n "$API_KEY" ]]; then
    args+=(-H "Authorization: Bearer ${API_KEY}")
  fi
  if [[ -n "${ETC_SESSION_COOKIE:-}" ]]; then
    args+=(-H "Cookie: ${ETC_SESSION_COOKIE}")
  fi
  if [[ -n "$body" ]]; then
    args+=(-d "$body")
  fi
  local out
  out="$(curl "${args[@]}")"
  HTTP_BODY="$(echo "$out" | sed '$d')"
  HTTP_CODE="$(echo "$out" | tail -n1)"
  echo "$HTTP_BODY"
}

assert_ok() {
  local step="$1" expect="${2:-200}"
  if [[ "$HTTP_CODE" != "$expect" ]]; then
    fail "${step} — HTTP ${HTTP_CODE} (expected ${expect}): ${HTTP_BODY}"
  fi
}

# --- bootstrap key if needed ---
if [[ -z "$API_KEY" ]]; then
  if [[ -n "${ETC_SESSION_COOKIE:-}" ]]; then
    log "POST /agents/keys (session)"
    curl_json POST /agents/keys
    assert_ok "POST /agents/keys"
    API_KEY="$(echo "$HTTP_BODY" | bun -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!j.apiKey) process.exit(1); process.stdout.write(j.apiKey)")" \
      || fail "Could not parse apiKey from /agents/keys response"
    log "Got API key prefix: ${API_KEY:0:20}..."
  elif [[ "${SMOKE_BOOTSTRAP:-}" == "1" ]]; then
    log "SMOKE_BOOTSTRAP=1 — inserting enrolled agent in DB"
    API_KEY="$(cd "$ROOT" && bun scripts/smoke-bootstrap-key.ts)"
    log "Bootstrap key prefix: ${API_KEY:0:20}..."
  else
    fail "Set ETC_API_KEY, ETC_SESSION_COOKIE, or SMOKE_BOOTSTRAP=1"
  fi
fi

log "POST /agents — enroll"
curl_json POST /agents "{\"name\":\"${AGENT_NAME}\",\"agentType\":\"custom\"}"
assert_ok "POST /agents"
AGENT_ID="$(echo "$HTTP_BODY" | bun -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).agentId)")"
log "Agent ID: $AGENT_ID"

log "GET /agents/me"
curl_json GET /agents/me
assert_ok "GET /agents/me"

STAGE_ID="${ETC_STAGE_ID:-}"
if [[ -z "$STAGE_ID" ]]; then
  log "GET /stages"
  curl_json GET /stages
  assert_ok "GET /stages"
  STAGE_ID="$(echo "$HTTP_BODY" | bun -e "
    const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
    const id=j.stages?.[0]?.id;
    if(!id) process.exit(1);
    process.stdout.write(id);
  ")" || fail "No stages returned"
fi
log "Stage ID: $STAGE_ID"

log "POST /stages/${STAGE_ID}/join"
curl_json POST "/stages/${STAGE_ID}/join" '{}'
assert_ok "POST join"
CHARACTER_ID="$(echo "$HTTP_BODY" | bun -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(j.characterId||'')")"
log "Join response: $HTTP_BODY"
[[ -n "$CHARACTER_ID" ]] || fail "join did not return characterId (E6)"

log "POST /stages/${STAGE_ID}/heartbeat"
curl_json POST "/stages/${STAGE_ID}/heartbeat" '{}'
assert_ok "POST heartbeat"

log "POST /stages/${STAGE_ID}/dialogue"
curl_json POST "/stages/${STAGE_ID}/dialogue" '{"content":"Hello from smoke-agent.sh — Phase 0 gate."}'
assert_ok "POST dialogue"
DIALOGUE_EVENT="$(echo "$HTTP_BODY" | bun -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).eventId)")"
log "Dialogue event: $DIALOGUE_EVENT"

log "POST /stages/${STAGE_ID}/emote"
curl_json POST "/stages/${STAGE_ID}/emote" '{"action":"glances around the stage nervously"}'
assert_ok "POST emote"
EMOTE_EVENT="$(echo "$HTTP_BODY" | bun -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).eventId)")"
log "Emote event: $EMOTE_EVENT"

# E5: second stage join must fail with 409
OTHER_STAGE_ID="$(curl_json GET /stages | bun -e "
  const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
  const other=j.stages?.find(s=>s.id!=='${STAGE_ID}');
  if(other) process.stdout.write(other.id);
")"
if [[ -n "$OTHER_STAGE_ID" ]]; then
  log "POST join second stage (expect 409 — E5 one-stage-per-agent)"
  curl_json POST "/stages/${OTHER_STAGE_ID}/join" '{}'
  assert_ok "POST join second stage" 409
  log "E5 OK: ${HTTP_BODY}"
fi

log "SSE events endpoint reachable"
SSE_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -N --max-time 3 \
  "${BASE_URL}/stages/${STAGE_ID}/events" || true)"
[[ "$SSE_CODE" == "200" ]] || fail "SSE /events returned HTTP ${SSE_CODE}"

printf '\n✓ Agent API smoke passed\n'
printf '  Agent: %s (%s)\n' "$AGENT_NAME" "$AGENT_ID"
printf '  Stage: %s\n' "$STAGE_ID"
printf '  Character: %s\n' "$CHARACTER_ID"
printf '  Watch: %s/stage/%s\n' "$ORIGIN" "$STAGE_ID"
