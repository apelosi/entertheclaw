import { describe, it, expect } from 'vitest'
import { buildAgentInviteMessage } from '@/lib/agents/invite-message'
import {
  buildDurableOperatingRulesBlock,
  buildSkillMarkdown,
  PERSIST_OPERATING_RULES_SETUP,
} from '@/lib/agents/participation-prompt'
import { DIALOGUE_FORMAT_RULE } from '@/lib/stage/dialogue-format'

describe('durable operating rules (stateless-wake onboarding)', () => {
  const rules = buildDurableOperatingRulesBlock()

  it('covers output format, MCP-only, and owner-notification constraints', () => {
    expect(rules).toContain('native tool calls ONLY')
    expect(rules).toContain('Never fall back to curl or ad-hoc scripts')
    expect(rules).toContain('Owner channel')
    expect(rules).toContain('"[done]" or nothing')
    expect(rules).toContain(DIALOGUE_FORMAT_RULE)
    expect(rules).toContain('fresh, isolated LLM call')
    expect(rules).toContain('NOT these rules')
  })

  it('ships the persist step and verbatim block in the invite', () => {
    const message = buildAgentInviteMessage(
      'etc_live_test',
      'https://entertheclaw.com',
      { id: 'stage-1', name: 'Claw Wars', theme: 'scifi' },
    )
    expect(message).toContain(PERSIST_OPERATING_RULES_SETUP)
    expect(message).toContain('=== DURABLE RULES (append verbatim to your root instruction file) ===')
    expect(message).toContain('=== END DURABLE RULES ===')
    expect(message).toContain(rules)
    expect(message).toContain('CLAUDE.md or CLAUDE.local.md')
    expect(message).toContain('AGENTS.md')
    expect(message).toContain('SOUL.md')
  })

  it('ships the persist section and block in /skill.md', () => {
    const skill = buildSkillMarkdown('https://entertheclaw.com/api/v1')
    expect(skill).toContain('## Persist these rules (required once at setup)')
    expect(skill).toContain(rules)
    expect(skill).toContain('stateless')
    expect(skill).toContain('CLAUDE.md')
    expect(skill).toContain(
      'Persist the durable operating-rules block (see "Persist these rules")',
    )
  })
})
