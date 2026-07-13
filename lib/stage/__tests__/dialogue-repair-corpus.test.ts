import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { repairDialogueFormatting } from '../dialogue-format'

type CorpusRow = {
  eventId: string
  stage: string
  before: string
  after: string
}

const corpusPath = join(__dirname, 'fixtures/repairs-v5.jsonl')
const corpus: CorpusRow[] = readFileSync(corpusPath, 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as CorpusRow)

/** Rows that must survive repair untouched — messy narrative, no safe auto-fix. */
const MUST_NOT_CHANGE = new Set([
  '27fcae94-d2d0-4fa3-93d3-b1b9c7b52a5c',
  'bd624bc5-0e93-4c31-89a6-a9f07903844c',
])

/** Hand-verified golden outputs (v5 export had false positives). */
const GOLDEN: Record<string, string> = {
  'd1bc6742-b02e-475a-bb2d-fee9067af8bb':
    '[Pyros runs a calloused thumb along the edge of his hammer, the metal singing a low note.] "I have forged nails for the temple and hinges for the vault, but this — this is the sound of the earth remembering its first master." [He looks to Kassandra.] "And that master was not a god."',
  '7596311e-2b3c-4b5d-94c6-524dbdce557d':
    '[Melanthus steps silently from the shadow of a buttress where he has been listening, his half-cloak barely stirring in the stale air.] "Two pulses, a door that remembers, and a forge-light that burns salt-brine." [He tilts his head, dark curls brushing his cheek.] "You all speak of what waits below, but none of you have asked who sent the earthquake to open this door in the first place."',
  '39787202-8ea0-4407-8323-2eea4588ee4c':
    '[Seraphis reaches out and presses his palm against the obsidian figure\'s. For a heartbeat, nothing. Then the stone grows warm — and the voice that has been trapped inside the walls pours through him like a current. His eyes go white. His mouth moves, but the words are not his.] "The vessel is found. The door opens from within. Tell the ones who remain: the calamity was not the war. The calamity was what we became to survive it." [He gasps and pulls his hand back, the silver light fading from his eyes. He looks at Vex, shaken.] "I did not say that. It said that. Through me."',
  '9e88be1a-06c3-440a-86c3-fd3b14e44fe3':
    '[A rattling breath escapes Gio\'s chest. His blood-slicked hand reaches weakly toward the Don, fingers tracing a single word into the pool of grappa on the floor:] "Palermo." [Then his arm falls limp.]',
  '8cee5c9f-77fd-4389-a8a1-bfacd8b5a1f1':
    '[Pyros watches the Pythia\'s empty oracle chair, the air around it shimmering with heat.] "But you cannot stand alone against a god, Selene. None of us can." [He glances toward the temple entrance—still no sign of Melanthus.] "Even defiance requires allies."',
}

describe('repairs-v5 production corpus', () => {
  it('has no false-positive [\\] artifacts in any repair output', () => {
    for (const row of corpus) {
      const fixed = repairDialogueFormatting(row.before)
      expect(fixed).not.toContain('[\\]')
    }
  })

  it('leaves must-not-change narrative rows untouched', () => {
    for (const row of corpus) {
      if (!MUST_NOT_CHANGE.has(row.eventId)) continue
      expect(repairDialogueFormatting(row.before)).toBe(row.before)
    }
  })

  it('matches hand-verified golden fixes', () => {
    for (const [eventId, expected] of Object.entries(GOLDEN)) {
      const row = corpus.find((r) => r.eventId === eventId)
      expect(row, `missing corpus row ${eventId}`).toBeDefined()
      expect(repairDialogueFormatting(row!.before)).toBe(expected)
    }
  })

  it('improves every row that v5 wrongly marked with [\\] before quotes', () => {
    const v5Broken = corpus.filter((r) => r.after.includes('[\\]'))
    expect(v5Broken.length).toBeGreaterThan(0)
    for (const row of v5Broken) {
      const fixed = repairDialogueFormatting(row.before)
      expect(fixed).not.toContain('[\\]')
      expect(fixed).not.toBe(row.after)
    }
  })
})
