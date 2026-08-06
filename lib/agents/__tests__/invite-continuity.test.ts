import { describe, it, expect } from 'vitest'
import {
  buildExistingAgentRejoinMessage,
  buildMistakenNewInviteSafetyBlock,
  ETC_ALREADY_ON_STAGE,
  ETC_REJOINING_WITH_EXISTING_KEY,
} from '@/lib/agents/invite-continuity'
import {
  buildAgentInviteMessage,
  buildRejoinInviteMessage,
} from '@/lib/agents/invite-message'
import { buildSkillMarkdown } from '@/lib/agents/participation-prompt'
import { MCP_SERVER_INSTRUCTIONS } from '@/lib/mcp/instructions'

describe('invite owner bifurcation (no CYOA in paste)', () => {
  it('NEW invite paste is linear — no NEW/EXISTING owner branching', () => {
    const message = buildAgentInviteMessage('etc_live_test', 'https://entertheclaw.com', {
      id: 'stage-1',
      name: 'Clawfather',
      theme: 'crime',
    })
    expect(message).toContain('=== SETUP ===')
    expect(message).toContain('ETC_HOST_WAKE_REQUIRED')
    expect(message).not.toContain('BEFORE YOU USE THIS INVITE')
    expect(message).not.toContain('NEW (none of the above)')
    expect(message).not.toContain('EXISTING (any artifact')
    expect(message).not.toContain(ETC_ALREADY_ON_STAGE)
    expect(message).not.toContain(ETC_REJOINING_WITH_EXISTING_KEY)
  })

  it('EXISTING rejoin paste keeps existing key and is linear for that path', () => {
    const message = buildRejoinInviteMessage('https://entertheclaw.com', {
      id: 'stage-1',
      name: 'Clawfather',
      theme: 'crime',
    })
    expect(message).toContain('ALREADY exist')
    expect(message).toContain('Do NOT enroll with a new API key')
    expect(message).toContain(ETC_ALREADY_ON_STAGE)
    expect(message).toContain(ETC_REJOINING_WITH_EXISTING_KEY)
    expect(message).not.toContain('API_KEY    =')
    expect(message).not.toContain('NEW (none of the above)')
  })

  it('skill documents owner UI choice + safety net', () => {
    const skill = buildSkillMarkdown('https://entertheclaw.com')
    expect(skill).toContain('owner chooses on invite UI')
    expect(skill).toContain('linear')
    expect(skill).toContain(ETC_ALREADY_ON_STAGE)
    expect(buildMistakenNewInviteSafetyBlock()).toContain('do not switch keys')
    expect(buildExistingAgentRejoinMessage('https://entertheclaw.com', {
      id: 's',
      name: 'S',
      theme: 'crime',
    }, 'https://entertheclaw.com/skill.md')).toContain('TARGET STAGE')
  })

  it('MCP instructions mention owner UI choice', () => {
    expect(MCP_SERVER_INSTRUCTIONS).toContain('invite UI chooses')
    expect(MCP_SERVER_INSTRUCTIONS).toContain(ETC_ALREADY_ON_STAGE)
  })
})
