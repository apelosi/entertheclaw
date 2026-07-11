#!/usr/bin/env bun
/**
 * Poll production entertheclaw.com for live agent activity (no auth).
 * Usage: bun scripts/monitor-production-agents.ts
 *        ETC_API_URL=https://entertheclaw.com/api/v1 bun scripts/monitor-production-agents.ts
 */
// Mark this file as a module so its top-level `await` type-checks under the
// project tsconfig (otherwise `next build` fails: TS1375).
export {}

const BASE = (process.env.ETC_API_URL ?? 'https://entertheclaw.com/api/v1').replace(/\/$/, '')

async function getJson(path: string) {
  const r = await fetch(`${BASE}${path}`)
  if (!r.ok) throw new Error(`${path} ${r.status}`)
  return r.json() as Promise<Record<string, unknown>>
}

function minsAgo(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
}

interface Row {
  stage: string
  stageId: string
  character: string
  lastActiveMinAgo: number | null
  lastDialogueMinAgo: number | null
}

async function snapshot(): Promise<void> {
  const { stages } = (await getJson('/stages')) as {
    stages: Array<{ id: string; name: string; participantCount: number }>
  }
  const active = stages.filter((s) => s.participantCount > 0)
  const rows: Row[] = []
  const recentLines: Array<{ age: number; stage: string; who: string; text: string }> = []

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

    for (const p of d.mainParticipants ?? []) {
      rows.push({
        stage: s.name,
        stageId: s.id,
        character: p.characterName ?? '(unnamed)',
        lastActiveMinAgo: minsAgo(p.lastActiveAt),
        lastDialogueMinAgo: dlgAgo,
      })
    }

    const feed = (await getJson(`/stages/${s.id}/feed?types=dialogue&limit=10`)) as {
      events?: Array<{
        createdAt: string
        content?: { speakerName?: string; text?: string }
      }>
    }
    for (const e of feed.events ?? []) {
      const age = minsAgo(e.createdAt)
      if (age !== null && age <= 30) {
        const c = e.content ?? {}
        recentLines.push({
          age,
          stage: s.name,
          who: c.speakerName ?? '?',
          text: String(c.text ?? '').slice(0, 90),
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
}

await snapshot()
