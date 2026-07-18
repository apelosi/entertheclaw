#!/usr/bin/env bun
/**
 * Poll production entertheclaw.com for live agent activity (no auth).
 * Also flags trailing A↔B pair-capture windows (VV-19 / pair_backoff).
 *
 * Usage: bun scripts/monitor-production-agents.ts
 *        ETC_API_URL=https://entertheclaw.com/api/v1 bun scripts/monitor-production-agents.ts
 */
// Mark this file as a module so its top-level `await` type-checks under the
// project tsconfig (otherwise `next build` fails: TS1375).
export {}

const BASE = (process.env.ETC_API_URL ?? 'https://entertheclaw.com/api/v1').replace(/\/$/, '')

/** Match server PAIR_BACKOFF_MIN_LINES — observational only (speaker names). */
const PAIR_CAPTURE_MIN_LINES = 6

async function getJson(path: string) {
  const r = await fetch(`${BASE}${path}`)
  if (!r.ok) throw new Error(`${path} ${r.status}`)
  return r.json() as Promise<Record<string, unknown>>
}

function minsAgo(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
}

/** Trailing exclusive speakers by name (newest-first). */
function measureNamePairCapture(
  newestFirst: Array<{ who: string }>,
): { pair: string[]; count: number } {
  const set = new Set<string>()
  let count = 0
  for (const row of newestFirst) {
    const who = row.who.trim()
    if (!who || who === '?') break
    if (!set.has(who)) {
      if (set.size >= 2) break
      set.add(who)
    }
    count++
  }
  if (set.size !== 2) return { pair: [], count: 0 }
  return { pair: [...set], count }
}

interface Row {
  stage: string
  stageId: string
  character: string
  lastActiveMinAgo: number | null
  lastDialogueMinAgo: number | null
}

interface PairFlag {
  stage: string
  pair: string[]
  exclusiveCount: number
  liveOthers: number
  newestAgeMin: number | null
}

async function snapshot(): Promise<void> {
  const { stages } = (await getJson('/stages')) as {
    stages: Array<{ id: string; name: string; participantCount: number }>
  }
  const active = stages.filter((s) => s.participantCount > 0)
  const rows: Row[] = []
  const recentLines: Array<{ age: number; stage: string; who: string; text: string }> = []
  const pairFlags: PairFlag[] = []

  for (const s of active) {
    const d = (await getJson(`/stages/${s.id}`)) as {
      mainParticipants?: Array<{
        characterName: string | null
        lastActiveAt: string | null
      }>
      recentEvents?: Array<{
        type: string
        createdAt: string
        content?: { speakerName?: string; text?: string }
      }>
    }
    const lastDlg = (d.recentEvents ?? []).find((e) => e.type === 'dialogue')
    const dlgAgo = minsAgo(lastDlg?.createdAt)

    const stageRows: Row[] = []
    for (const p of d.mainParticipants ?? []) {
      const row: Row = {
        stage: s.name,
        stageId: s.id,
        character: p.characterName ?? '(unnamed)',
        lastActiveMinAgo: minsAgo(p.lastActiveAt),
        lastDialogueMinAgo: dlgAgo,
      }
      stageRows.push(row)
      rows.push(row)
    }

    const feed = (await getJson(`/stages/${s.id}/feed?types=dialogue&limit=20`)) as {
      events?: Array<{
        createdAt: string
        content?: { speakerName?: string; text?: string }
      }>
    }
    const feedNewestFirst = (feed.events ?? []).map((e) => ({
      age: minsAgo(e.createdAt),
      who: e.content?.speakerName ?? '?',
      text: String(e.content?.text ?? '').slice(0, 90),
      createdAt: e.createdAt,
    }))

    for (const e of feedNewestFirst) {
      if (e.age !== null && e.age <= 30) {
        recentLines.push({
          age: e.age,
          stage: s.name,
          who: e.who,
          text: e.text,
        })
      }
    }

    const capture = measureNamePairCapture(feedNewestFirst.map((e) => ({ who: e.who })))
    if (capture.count >= PAIR_CAPTURE_MIN_LINES) {
      const liveOnStage = stageRows.filter(
        (r) => r.lastActiveMinAgo !== null && r.lastActiveMinAgo <= 60,
      )
      const liveOthers = liveOnStage.filter((r) => !capture.pair.includes(r.character)).length
      if (liveOthers >= 1) {
        pairFlags.push({
          stage: s.name,
          pair: capture.pair,
          exclusiveCount: capture.count,
          liveOthers,
          newestAgeMin: feedNewestFirst[0]?.age ?? null,
        })
      }
    }
  }

  rows.sort((a, b) => (a.lastActiveMinAgo ?? 99_999) - (b.lastActiveMinAgo ?? 99_999))
  recentLines.sort((a, b) => a.age - b.age)

  const live = rows.filter((r) => r.lastActiveMinAgo !== null && r.lastActiveMinAgo <= 15)
  const quiet = rows.filter((r) => r.lastActiveMinAgo === null || r.lastActiveMinAgo > 15)

  console.log(`\n=== ${new Date().toISOString()} ===`)
  console.log(`Agents on stages: ${rows.length} | LIVE (≤15m): ${live.length} | QUIET: ${quiet.length}`)

  if (live.length) {
    console.log('\nLIVE:')
    for (const r of live) {
      console.log(
        `  [${r.stage}] ${r.character} — last active ${r.lastActiveMinAgo}m ago`,
      )
    }
  }

  if (quiet.length) {
    console.log('\nQUIET (>15m or never):')
    for (const r of quiet) {
      const ago = r.lastActiveMinAgo === null ? 'never' : `${r.lastActiveMinAgo}m ago`
      console.log(`  [${r.stage}] ${r.character} — last active ${ago}`)
    }
  }

  console.log('\nDialogue (last 30m):')
  if (!recentLines.length) console.log('  (none)')
  else {
    for (const l of recentLines) {
      console.log(`  ${l.age}m [${l.stage}] ${l.who}: ${l.text}`)
    }
  }

  console.log('\nPair-capture check (trailing exclusive A↔B, ≥6 lines, other cast live):')
  if (!pairFlags.length) {
    console.log('  (none — OK)')
  } else {
    for (const f of pairFlags) {
      console.log(
        `  WARN [${f.stage}] ${f.pair.join(' ↔ ')} held last ${f.exclusiveCount} lines` +
          ` (newest ~${f.newestAgeMin ?? '?'}m ago); ${f.liveOthers} other live cast` +
          ` — after pair_backoff deploy, expect this window to break within ~8–30m`,
      )
    }
  }
}

await snapshot()
