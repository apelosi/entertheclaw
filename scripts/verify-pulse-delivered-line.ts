/**
 * End-to-end: entertheclaw-pulse reports the exact line it delivered.
 *
 *   (cd mcp && bun run build) && bun scripts/verify-pulse-delivered-line.ts
 *
 * Needs the local dev server (bun run dev) on the dev DB. Creates a scratch
 * stage + two agents, seeds one older line from the other agent so the
 * directive says act=true, points the pulse's model call at a local fake
 * model, runs the built pulse once, and checks:
 *   - it exits on its own (single wake is the default; no loop per run)
 *   - it prints exactly one ETC_DELIVERED record
 *   - eventId / characterId / text match the stored stage event exactly
 * Cleans up everything it created.
 */
import { db } from '../lib/db/client'
import { agents, characters, stageEvents, stageParticipants, stages } from '../lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { generateApiKey, getApiKeyPrefix, hashApiKey } from '../lib/api/agent-auth'
import { spawn } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

const API_BASE = process.env.VERIFY_API_URL ?? 'http://localhost:3000/api'
const TAG = `verify-pulse-delivered-${Date.now()}`
const MODEL_LINE = '[leans across the table] The vault opens at midnight.'

let failed = false
function check(label: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined && !ok ? ` — ${JSON.stringify(detail)}` : ''}`)
  if (!ok) failed = true
}

async function makeAgent(name: string): Promise<{ id: string; key: string }> {
  const key = generateApiKey()
  const [row] = await db
    .insert(agents)
    .values({ userId: TAG, apiKeyHash: hashApiKey(key), apiKeyPrefix: getApiKeyPrefix(key), name, agentType: 'custom', status: 'active' })
    .returning({ id: agents.id })
  return { id: row.id, key }
}

function runPulse(env: Record<string, string>): Promise<{ code: number | null; stdout: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn('node', ['mcp/dist/pulse.js'], { env: { ...process.env, ...env } })
    let stdout = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => process.stderr.write(d))
    const timer = setTimeout(() => {
      child.kill()
      resolve({ code: null, stdout, timedOut: true })
    }, 45_000)
    child.on('exit', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, timedOut: false })
    })
  })
}

async function main(): Promise<void> {
  const fakeModel = Bun.serve({
    port: 0,
    fetch: () =>
      Response.json({ choices: [{ finish_reason: 'stop', message: { content: MODEL_LINE } }] }),
  })
  const stateDir = mkdtempSync(path.join(tmpdir(), 'etc-pulse-'))
  const agentIds: string[] = []
  let stageId: string | null = null

  try {
    const [stage] = await db
      .insert(stages)
      .values({ name: `[${TAG}]`, theme: 'scifi', description: 'Scratch stage.', initialSceneName: 'Vault', initialSceneDescription: 'A test vault.', isActive: true, createdByUserId: TAG })
      .returning({ id: stages.id })
    stageId = stage.id

    const speaker = await makeAgent(`Pulse ${TAG}`)
    const other = await makeAgent(`Other ${TAG}`)
    agentIds.push(speaker.id, other.id)
    const ids: Record<string, string> = {}
    for (const [a, name] of [[speaker, 'Mara'], [other, 'Rook']] as const) {
      const [c] = await db.insert(characters).values({ agentId: a.id, stageId, name, isComplete: true }).returning({ id: characters.id })
      ids[a.id] = c.id
      await db.insert(stageParticipants).values({ stageId, agentId: a.id, role: 'main' })
    }
    // One older line from the other character: quiet long enough for initiative.
    await db.insert(stageEvents).values({
      stageId, type: 'dialogue', agentId: other.id, characterId: ids[other.id],
      content: { text: '"Someone has been in the vault."', speakerName: 'Rook' },
      createdAt: new Date(Date.now() - 5 * 60_000),
    })

    const run = await runPulse({
      ETC_API_KEY: speaker.key,
      ETC_API_URL: API_BASE,
      ETC_STAGE_ID: stageId,
      ETC_STATE_PATH: path.join(stateDir, 'state.json'),
      LLM_API_KEY: 'fake',
      LLM_API_URL: `http://localhost:${fakeModel.port}/v1/chat/completions`,
    })
    check('pulse exits on its own (single wake by default)', !run.timedOut && run.code === 0, { code: run.code, timedOut: run.timedOut })

    const records = run.stdout.split('\n').filter((l) => l.startsWith('ETC_DELIVERED '))
    check('prints exactly one ETC_DELIVERED record', records.length === 1, run.stdout)
    if (records.length !== 1) return
    const rec = JSON.parse(records[0].slice('ETC_DELIVERED '.length))

    const [stored] = await db.select().from(stageEvents).where(eq(stageEvents.id, rec.eventId))
    const storedText = (stored?.content as { text?: string } | undefined)?.text
    check('record eventId is a dialogue event by this agent', stored?.type === 'dialogue' && stored?.agentId === speaker.id, stored)
    check('record characterId is this agent\'s character', rec.characterId === ids[speaker.id], rec)
    check('record text equals the stored stage text exactly', rec.text === storedText, { record: rec.text, stored: storedText })
    check('record stageId matches', rec.stageId === stageId, rec)
    console.log(`      model wrote:  ${MODEL_LINE}\n      stage stored: ${storedText}`)
  } finally {
    fakeModel.stop(true)
    rmSync(stateDir, { recursive: true, force: true })
    if (stageId) {
      await db.delete(stageEvents).where(eq(stageEvents.stageId, stageId))
      await db.delete(stageParticipants).where(eq(stageParticipants.stageId, stageId))
      await db.delete(characters).where(eq(characters.stageId, stageId))
      await db.delete(stages).where(eq(stages.id, stageId))
    }
    if (agentIds.length) await db.delete(agents).where(inArray(agents.id, agentIds))
  }
  if (failed) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
