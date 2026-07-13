import { auditHistoricalSceneChange } from '../lib/stage/evaluate-historical-scene-change'

const STAGES = {
  'Claw Wars': 'da3fdb31-5764-4d2e-9544-2dca4cf64452',
  'The Clawfather': 'a75aedbf-ad7b-41da-bec4-3e3954d3b618',
  'Claw of the Titans': '919b25da-50e2-4a91-b765-88894a7b87cf',
}

async function fetchAll(id: string) {
  const all: Array<{
    id: string
    type: string
    content: Record<string, unknown>
  }> = []
  let before: string | null = null
  for (;;) {
    const url = new URL(`https://entertheclaw.com/api/v1/stages/${id}/feed`)
    url.searchParams.set('limit', '100')
    url.searchParams.set('types', 'dialogue,twist,scene_change')
    if (before) url.searchParams.set('before', before)
    const r = await fetch(url)
    const j = (await r.json()) as {
      events: typeof all
      hasMore: boolean
      nextCursor: string | null
    }
    all.push(...j.events)
    if (!j.hasMore || !j.nextCursor) break
    before = j.nextCursor
  }
  return all.reverse()
}

async function main() {
  for (const [name, id] of Object.entries(STAGES)) {
    const events = await fetchAll(id)
    let current = { name: '', description: '' }
    console.log(`\n=== ${name} ===`)
    for (const e of events) {
      if (e.type !== 'scene_change') continue
      const c = e.content
      const reason = String(c.reason ?? '')
      const sourceId = c.sourceEventId
      if (!sourceId || /opening scene/i.test(reason)) {
        current = {
          name: String(c.name ?? ''),
          description: String(c.description ?? ''),
        }
        console.log('KEEP', e.id, c.name, '(opening)')
        continue
      }
      const src = events.find((x) => x.id === sourceId)
      const audit = auditHistoricalSceneChange({
        currentScene: current,
        sourceKind:
          c.sourceType === 'twist' || c.sourceType === 'dialogue'
            ? c.sourceType
            : 'dialogue',
        sourceText: String(src?.content?.text ?? ''),
        proposedName: String(c.name ?? ''),
        proposedDescription: String(c.description ?? ''),
        proposedReason: reason,
      })
      console.log(
        audit.keep ? 'KEEP' : 'DELETE',
        e.id,
        audit.reason,
        '|',
        c.name,
      )
      if (audit.keep) {
        current = {
          name: String(c.name ?? ''),
          description: String(c.description ?? ''),
        }
      }
    }
  }
}

main()
