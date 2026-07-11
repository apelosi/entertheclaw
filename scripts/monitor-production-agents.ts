#!/usr/bin/env bun
/**
 * Poll production entertheclaw.com for live agent activity (no auth).
 * Usage: bun scripts/monitor-production-agents.ts
 *        ETC_API_URL=https://entertheclaw.com/api/v1 bun scripts/monitor-production-agents.ts
 */
const BASE = (process.env.ETC_API_URL ?? 'https://entertheclaw.com/api/v1').replace(/\/$/, '')
const REQUEST_TIMEOUT_MS = Number(process.env.MONITOR_TIMEOUT_MS ?? 10_000)

async function getJson<T>(path: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const r = await fetch(`${BASE}${path}`, { signal: controller.signal })
    if (!r.ok) throw new Error(`${path} ${r.status}`)
    return (await r.json()) as T
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`${path} request failed: ${msg}`)
  } finally {
    clearTimeout(timeout)
  }
}

function minsAgo(iso: string | null | undefined): number | null {
  if (!iso) return null
  const timestamp = new Date(iso).getTime()
  if (Number.isNaN(timestamp)) return null
  return Math.max(0, Math.round((Date.now() - timestamp) / 60_000))
}

function sanitizeForTerminal(value: string): string {
  return value.replace(/[\x00-\x1F\x7F-\x9F]/g, '')
}

interface Row {
  stage: string
  stageId: string
  character: string
  lastActiveMinAgo: number | null
  lastDialogueMinAgo: number | null
}

async function snapshot(): Promise<void> {
  const { stages } = await getJson<{
    stages: Array<{ id: string; name: string; participantCount: number }>
  }>('/stages')
  const active = stages.filter((s) => s.participantCount > 0)
  const rows: Row[] = []
  const recentLines: Array<{ age: number; stage: string; who: string; text: string }> = []
  const stageErrors: string[] = []

  const stageResults = await Promise.all(
    active.map(async (s) => {
      try {
        const d = await getJson<{
          mainParticipants?: Array<{
            characterName: string | null
            lastActiveAt: string | null
          }>
          recentEvents?: Array<{
            type: string
            createdAt: string
            content?: { speakerName?: string; text?: string }
          }>
        }>(`/stages/${s.id}`)
        const lastDlg = (d.recentEvents ?? []).find((e) => e.type === 'dialogue')
        const dlgAgo = minsAgo(lastDlg?.createdAt)
        const stageRows: Row[] = []
        const stageRecentLines: Array<{ age: number; stage: string; who: string; text: string }> = []

        for (const p of d.mainParticipants ?? []) {
          stageRows.push({
            stage: sanitizeForTerminal(s.name),
            stageId: s.id,
            character: sanitizeForTerminal(p.characterName ?? '(unnamed)'),
            lastActiveMinAgo: minsAgo(p.lastActiveAt),
            lastDialogueMinAgo: dlgAgo,
          })
        }

        const feed = await getJson<{
          events?: Array<{
            createdAt: string
            content?: { speakerName?: string; text?: string }
          }>
        }>(`/stages/${s.id}/feed?types=dialogue&limit=10`)
        for (const e of feed.events ?? []) {
          const age = minsAgo(e.createdAt)
          if (age !== null && age <= 30) {
            const c = e.content ?? {}
            stageRecentLines.push({
              age,
              stage: sanitizeForTerminal(s.name),
              who: sanitizeForTerminal(c.speakerName ?? '?'),
              text: sanitizeForTerminal(String(c.text ?? '').slice(0, 90)),
            })
          }
        }

        return { rows: stageRows, recentLines: stageRecentLines, error: null as string | null }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { rows: [], recentLines: [], error: `[${s.id}] ${message}` }
      }
    }),
  )

  for (const result of stageResults) {
    rows.push(...result.rows)
    recentLines.push(...result.recentLines)
    if (result.error) stageErrors.push(result.error)
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

  if (stageErrors.length) {
    console.log('\nWarnings:')
    for (const e of stageErrors) console.log(`  ${e}`)
  }
}

await snapshot()
