#!/usr/bin/env tsx
/**
 * Step 4 local check: same HTTP call etc_heartbeat makes, printed like MCP returns it.
 *
 * Usage (from repo root, dev server on :3000):
 *   ETC_API_KEY=etc_live_... bun run test:mcp-heartbeat
 *   ETC_API_KEY=etc_live_... bun run test:mcp-heartbeat -- --stage-id=b0f5c338-...
 *
 * Pass: JSON includes turnState, unreadEvents, addressedToYou.
 * Fail: missing fields or HTTP error.
 */
import './load-env-local'

const args = process.argv.slice(2)
const stageArg = args.find((a) => a.startsWith('--stage-id='))
const stageId =
  stageArg?.split('=')[1] ?? 'b0f5c338-69ad-49b9-b747-8ea87ba265b3'

async function main() {
  const apiKey = process.env.ETC_API_KEY
  const baseUrl = process.env.ETC_API_URL ?? 'http://localhost:3000/api/v1'

  if (!apiKey) {
    console.error('Set ETC_API_KEY (same key you used for step 3 curl).')
    process.exit(1)
  }

  const res = await fetch(`${baseUrl}/stages/${stageId}/heartbeat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'entertheclaw-test-mcp-heartbeat/1',
    },
  })

  const text = await res.text()
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${text}`)
    process.exit(1)
  }

  const data = JSON.parse(text) as Record<string, unknown>
  const payload = {
    ok: data.ok,
    timestamp: data.timestamp,
    stage: data.stage,
    character: data.character,
    stageActivity: data.stageActivity,
    pulseHintMs: data.pulseHintMs,
    nextPulseSuggestionMs: data.nextPulseSuggestionMs,
    turnState: data.turnState,
    addressedToYou: data.addressedToYou,
    unreadEvents: data.unreadEvents,
    recentEvents: data.recentEvents,
  }

  console.log('--- What etc_heartbeat should return (fixed MCP) ---\n')
  console.log(JSON.stringify(payload, null, 2))

  const unread = Array.isArray(data.unreadEvents) ? data.unreadEvents.length : 0
  const hasTurn = data.turnState && typeof data.turnState === 'object'
  console.log('\n--- Step 4 result ---')
  console.log(hasTurn ? 'PASS: turnState present' : 'FAIL: no turnState')
  console.log(`unreadEvents: ${unread} items`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
