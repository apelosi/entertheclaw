import { describe, it, expect } from 'vitest'
import {
  buildExistingAgentRepairMessage,
  buildMistakenNewInviteSafetyBlock,
  ETC_ALREADY_ON_STAGE,
  ETC_REPAIR_OFF_STAGE,
  ETC_REPAIR_ON_STAGE,
  ETC_REJOINING_WITH_EXISTING_KEY,
} from '@/lib/agents/invite-continuity'
import {
  buildAgentInviteMessage,
  buildHostWakePrompt,
  buildRepairInviteMessage,
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
    expect(message).not.toContain(ETC_REPAIR_ON_STAGE)
    expect(message).not.toContain(ETC_REPAIR_OFF_STAGE)
  })

  it('EXISTING repair paste keeps key, refreshes, never joins or leaves stages', () => {
    const message = buildRepairInviteMessage('https://entertheclaw.com')
    expect(message).toContain('need a FIX')
    expect(message).toContain('Do NOT enroll with a new API key')
    expect(message).toContain('Do NOT call etc_join')
    expect(message).toContain(ETC_REPAIR_ON_STAGE)
    expect(message).toContain(ETC_REPAIR_OFF_STAGE)
    expect(message).not.toContain('etc_join (new character')
    expect(message).not.toContain('TARGET STAGE')
    expect(message).not.toContain('API_KEY    =')
    expect(message).not.toContain(ETC_REJOINING_WITH_EXISTING_KEY)
    expect(message).not.toContain('NEW (none of the above)')
  })

  it('skill documents owner UI choice + safety net without paste-driven join', () => {
    const skill = buildSkillMarkdown('https://entertheclaw.com')
    expect(skill).toContain('owner chooses on invite UI')
    expect(skill).toContain('linear')
    expect(skill).toContain(ETC_REPAIR_ON_STAGE)
    expect(skill).toContain(ETC_REPAIR_OFF_STAGE)
    expect(skill).toContain('Never join, leave, or switch')
    expect(buildMistakenNewInviteSafetyBlock()).toContain('do not switch keys')
    expect(buildMistakenNewInviteSafetyBlock()).toContain('do NOT join from the mistaken NEW paste')
    expect(
      buildExistingAgentRepairMessage(
        'https://entertheclaw.com',
        'https://entertheclaw.com/skill.md',
      ),
    ).toContain('DO NOT CHANGE STAGES')
  })

  it('MCP instructions mention repair paste never changes stages', () => {
    expect(MCP_SERVER_INSTRUCTIONS).toContain('invite UI chooses')
    expect(MCP_SERVER_INSTRUCTIONS).toContain('never join, leave, or switch stages')
    expect(MCP_SERVER_INSTRUCTIONS).toContain(ETC_REPAIR_OFF_STAGE)
  })

  it('host wake prompt names the agent, never embeds an API key, requires MCP+Slack', () => {
    const prompt = buildHostWakePrompt({
      siteOrigin: 'https://entertheclaw.com',
      stageId: 'stage-1',
      stageName: 'Clawfather',
      agentName: 'NanoClaw ETC9',
      agentType: 'nanoclaw',
    })
    expect(prompt).toContain('HOST level')
    expect(prompt).toContain('ETC_HOST_WAKE_REQUIRED')
    expect(prompt).toContain('AGENT_NAME = NanoClaw ETC9')
    expect(prompt).toContain('Infer this runtime\'s host group')
    expect(prompt).toContain('install ROOT')
    expect(prompt).toContain('Do NOT ask the owner for an API key')
    expect(prompt).toContain('Load the existing ETC_API_KEY already on this host')
    expect(prompt).toContain('ETC_API_URL = https://entertheclaw.com/api')
    expect(prompt).toContain('STAGE_ID   = stage-1')
    expect(prompt).toContain('https://entertheclaw.com/mcp')
    expect(prompt).toContain('Authorization: Bearer')
    expect(prompt).toContain('OWNER CHANNEL (Slack)')
    expect(prompt).toContain('ONE short confirmation')
    expect(prompt).toContain('https://entertheclaw.com/skill.md')
    expect(prompt).not.toContain('etc_live_')
    expect(prompt).not.toContain('ETC_API_KEY =')
    expect(prompt).not.toContain('NANOCLAW_GROUP_ID')
    expect(prompt).not.toContain('ncl tasks create')
  })
})
