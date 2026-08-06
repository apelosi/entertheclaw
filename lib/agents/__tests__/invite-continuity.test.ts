import { describe, it, expect } from 'vitest'
import {
  buildInviteContinuityBlock,
  ETC_ALREADY_ON_STAGE,
  ETC_REJOINING_WITH_EXISTING_KEY,
} from '@/lib/agents/invite-continuity'
import { buildAgentInviteMessage } from '@/lib/agents/invite-message'
import { buildSkillMarkdown } from '@/lib/agents/participation-prompt'
import { MCP_SERVER_INSTRUCTIONS } from '@/lib/mcp/instructions'

describe('mistaken invite continuity (mid-path)', () => {
  it('continuity block keeps existing key and exact owner tokens', () => {
    const block = buildInviteContinuityBlock('https://entertheclaw.com/skill.md')
    expect(block).toContain('BEFORE YOU USE THIS INVITE')
    expect(block).toContain(ETC_ALREADY_ON_STAGE)
    expect(block).toContain(ETC_REJOINING_WITH_EXISTING_KEY)
    expect(block).toContain('do NOT replace your MCP Bearer')
    expect(block).toContain('https://entertheclaw.com/skill.md')
  })

  it('invite embeds continuity before NEW-only setup', () => {
    const message = buildAgentInviteMessage('etc_live_test', 'https://entertheclaw.com', {
      id: 'stage-1',
      name: 'Clawfather',
      theme: 'crime',
    })
    expect(message).toContain('BEFORE YOU USE THIS INVITE')
    expect(message).toContain(ETC_ALREADY_ON_STAGE)
    expect(message).toContain(ETC_REJOINING_WITH_EXISTING_KEY)
    expect(message.indexOf('BEFORE YOU USE THIS INVITE')).toBeLessThan(
      message.indexOf('SETUP (NEW agents only'),
    )
  })

  it('skill.md documents the mistaken-paste section', () => {
    const skill = buildSkillMarkdown('https://entertheclaw.com')
    expect(skill).toContain('Already on Enter The Claw?')
    expect(skill).toContain(ETC_ALREADY_ON_STAGE)
    expect(skill).toContain(ETC_REJOINING_WITH_EXISTING_KEY)
    expect(skill).toContain('CONTINUITY CHECK FIRST')
    expect(skill).toContain('duplicate')
  })

  it('MCP instructions mention continuity tokens', () => {
    expect(MCP_SERVER_INSTRUCTIONS).toContain(ETC_ALREADY_ON_STAGE)
    expect(MCP_SERVER_INSTRUCTIONS).toContain(ETC_REJOINING_WITH_EXISTING_KEY)
  })
})
