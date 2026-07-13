import { describe, it, expect } from 'vitest'
import {
  buildDirective,
  backstoryHook,
  dialogueForPrompt,
  truncateMemoryForPrompt,
  MAX_PROMPT_CHARS_STRESS,
  type DirectiveInputs,
} from '@/lib/stage/build-directive'

function baseInput(overrides: Partial<DirectiveInputs> = {}): DirectiveInputs {
  return {
    myAgentId: 'agent-1',
    stageName: 'Claw Wars',
    character: {
      name: 'Verra Kell',
      occupation: 'Court spy',
      appearance: 'Tall, hooded, silver eyes',
      backstory:
        'Raised in the undercity, Verra learned to read faces before words. She owes a debt to the Shadow Guild and hunts the assassin who killed her mentor.',
    },
    characterMemory:
      'I arrived at court posing as a minor noble attendant. The Duke suspects someone is leaking secrets; I have been watching Lady Maren.',
    currentScene: {
      name: 'Moonlit Balcony',
      description: 'Cold wind off the bay. Torches gutter below.',
    },
    activeTwist: { text: 'A messenger collapses at the gate bearing a sealed letter for the King.' },
    recentDialogue: [
      { speakerName: 'Maren', text: 'Then you know more than you should.', agentId: 'agent-2' },
      {
        speakerName: 'Verra Kell',
        text: '[steps from shadow] "Only because you lied to the council."',
        agentId: 'agent-1',
      },
      { speakerName: 'Maren', text: 'You followed me.', agentId: 'agent-2' },
    ],
    turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 5_000 },
    addressedToYou: true,
    nudge: null,
    unreadHasTwist: false,
    idleRetryAfterMs: 60_000,
    consecutiveSoloDialogueCount: 0,
    ...overrides,
  }
}

describe('backstoryHook', () => {
  it('keeps the first sentence when short enough', () => {
    expect(backstoryHook('Born in the hills. She left at sixteen.')).toBe('Born in the hills.')
  })

  it('truncates long single-sentence backstory', () => {
    const long = 'A'.repeat(200)
    const hook = backstoryHook(long)
    expect(hook).not.toBeNull()
    expect(hook!.length).toBeLessThanOrEqual(121)
  })
})

describe('dialogueForPrompt', () => {
  it('returns lines since this agent last spoke', () => {
    const recent = [
      { speakerName: 'B', text: 'newest', agentId: 'agent-2' },
      { speakerName: 'A', text: 'mine', agentId: 'agent-1' },
      { speakerName: 'C', text: 'older', agentId: 'agent-3' },
    ]
    expect(dialogueForPrompt(recent, 'agent-1').map((l) => l.text)).toEqual(['newest'])
  })

  it('falls back to last N lines when agent has not spoken yet', () => {
    const recent = [
      { speakerName: 'B', text: 'two', agentId: 'agent-2' },
      { speakerName: 'C', text: 'one', agentId: 'agent-3' },
    ]
    expect(dialogueForPrompt(recent, 'agent-1').length).toBe(2)
  })
})

describe('truncateMemoryForPrompt', () => {
  it('caps long memory blobs', () => {
    const capped = truncateMemoryForPrompt('x'.repeat(5_000))
    expect(capped!.length).toBeLessThanOrEqual(1201)
  })
})

describe('buildDirective prompt size', () => {
  it('typical production wake stays under 5k chars', () => {
    const directive = buildDirective(baseInput())
    expect(directive.act).toBe(true)
    expect(directive.prompt!.length).toBeLessThan(5_000)
  })

  it('stress fixture stays under 16k chars (~4k token proxy)', () => {
    const longBackstory = 'Epic lore. '.repeat(80)
    const longMemory = 'I remember '.repeat(400)
    const longScene = 'A vast hall. '.repeat(60)
    const longLines = Array.from({ length: 12 }, (_, i) => ({
      speakerName: `Char${i}`,
      text: 'A fairly long dialogue line about the scene. '.repeat(10),
      agentId: i === 11 ? 'agent-1' : 'agent-2',
    }))

    const directive = buildDirective(
      baseInput({
        character: {
          name: 'Theron',
          occupation: 'Knight',
          appearance: 'Scarred, armored',
          backstory: longBackstory,
        },
        characterMemory: longMemory,
        currentScene: { name: 'Throne Room', description: longScene },
        recentDialogue: longLines,
        addressedToYou: false,
        turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 200_000 },
        consecutiveSoloDialogueCount: 0,
      }),
    )

    expect(directive.prompt!.length).toBeLessThan(MAX_PROMPT_CHARS_STRESS)
  })

  it('does not nest extra quotes around lines that already contain dialogue quotes', () => {
    const directive = buildDirective(
      baseInput({
        recentDialogue: [
          {
            speakerName: 'Kaelen Voss',
            text: '[steps from shadow] "Only because you lied to the council."',
            agentId: 'agent-2',
          },
        ],
        addressedToYou: true,
      }),
    )
    const block = directive.prompt!.split('RECENT DIALOGUE:\n')[1].split('\n\nCUE:')[0]
    expect(block).toBe(
      'Kaelen Voss: [steps from shadow] "Only because you lied to the council."',
    )
    expect(block).not.toMatch(/"\[/)
  })

  it('uses structured sections and a short backstory hook', () => {
    const directive = buildDirective(baseInput())
    const prompt = directive.prompt!
    expect(prompt).toContain('STAGE:')
    expect(prompt).toContain('ACTIVE TWIST:')
    expect(prompt).toContain('YOUR CHARACTER:')
    expect(prompt).toContain('RECENT DIALOGUE:')
    expect(prompt).not.toContain('3–5 sentence beat')
    expect(prompt).not.toContain(longBackstoryParagraph())
  })
})

function longBackstoryParagraph(): string {
  return 'She owes a debt to the Shadow Guild and hunts the assassin who killed her mentor.'
}
