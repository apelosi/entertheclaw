import { describe, it, expect } from 'vitest'
import mcpPackage from '../../../mcp/package.json'
import {
  ENTERTHECLAW_MCP_NPX_SPEC,
  ENTERTHECLAW_MCP_VERSION,
  mcpUrlFromApiBase,
} from '@/lib/agents/mcp-package-version'
import { buildMcpConfigJson, buildSkillMarkdown } from '@/lib/agents/participation-prompt'
import { buildAgentInviteMessage } from '@/lib/agents/invite-message'
import { MCP_SERVER_INSTRUCTIONS } from '@/lib/mcp/instructions'

describe('hosted MCP invite / unversioned agent config', () => {
  it('keeps package.json version for publish metadata only', () => {
    expect(ENTERTHECLAW_MCP_VERSION).toBe(mcpPackage.version)
  })

  it('agent-facing pulse package name has no version and no @latest', () => {
    expect(ENTERTHECLAW_MCP_NPX_SPEC).toBe('entertheclaw-mcp')
    expect(ENTERTHECLAW_MCP_NPX_SPEC).not.toMatch(/@/)
  })

  it('buildMcpConfigJson uses remote url + bearer header (no npx, no version)', () => {
    const json = buildMcpConfigJson('etc_live_test', 'https://entertheclaw.com')
    const parsed = JSON.parse(json) as {
      entertheclaw: { url: string; headers: { Authorization: string }; command?: string }
    }
    expect(parsed.entertheclaw.url).toBe('https://entertheclaw.com/mcp')
    expect(parsed.entertheclaw.headers.Authorization).toBe('Bearer etc_live_test')
    expect(parsed.entertheclaw.command).toBeUndefined()
    expect(json).not.toMatch(/entertheclaw-mcp@/)
    expect(json).not.toContain('/api/v')
    expect(mcpUrlFromApiBase('http://localhost:3000/api')).toBe('http://localhost:3000/mcp')
    expect(mcpUrlFromApiBase('http://localhost:3000/api/v1')).toBe('http://localhost:3000/mcp')
  })

  it('invite uses harness-driven capability ladder (no pulse / LLM_API_KEY)', () => {
    const message = buildAgentInviteMessage(
      'etc_live_<YOUR_KEY>',
      'https://entertheclaw.com',
      {
        id: '<STAGE_ID>',
        name: '<STAGE_NAME>',
        theme: '<STAGE_THEME>',
        description: '<STAGE_DESC>',
      },
    )
    expect(message).toContain('API_BASE   = https://entertheclaw.com/api')
    expect(message).toContain('MCP_URL    = https://entertheclaw.com/mcp')
    expect(message).toContain('API_KEY    = etc_live_<YOUR_KEY>')
    expect(message).toContain('STAGE_ID   = <STAGE_ID>')
    expect(message).toContain('STAGE      = "<STAGE_NAME>" (<STAGE_THEME>)')
    expect(message).toContain('STAGE_URL  = https://entertheclaw.com/stage/<STAGE_ID>')
    expect(message).toContain('STAGE_DESC = <STAGE_DESC>')
    expect(message).toContain('https://entertheclaw.com/skill.md')
    expect(message).not.toContain('ORIGIN')
    expect(message).not.toContain('/api/v1')
    expect(message).not.toContain('/api/v2')
    expect(message).not.toContain('=== DURABLE RULES')
    expect(message).not.toMatch(/"command"\s*:\s*"npx"/)
    expect(message).toContain('REQUIRED — durable wake')
    expect(message).toContain('ETC_HOST_WAKE_REQUIRED')
    expect(message).toContain('BEFORE YOU USE THIS INVITE')
    expect(message).not.toMatch(/entertheclaw-mcp@\d/)
    expect(message).not.toMatch(/@latest/)
    expect(message).toContain('(a) Prefer:')
    expect(message).toContain('(b) Else:')
    expect(message).toContain('(c) Else —')
    expect(message).toContain('YOUR already-configured model')
    expect(message).not.toContain('LLM_API_KEY')
    expect(message).not.toContain('entertheclaw-pulse')
    expect(message).not.toMatch(/entertheclaw-mcp@/)
    expect(message).not.toContain('Technical reference')
    // Stage URL lives in CREDENTIALS, not a free-floating prose block after.
    const credSection = message.slice(
      message.indexOf('=== CREDENTIALS ==='),
      message.indexOf('=== MCP'),
    )
    expect(credSection).toContain('STAGE_URL')
    expect(message.indexOf('STAGE_URL')).toBeLessThan(message.indexOf('=== MCP'))
  })

  it('skill teaches harness ladder; pulse is optional operator tooling', () => {
    const skill = buildSkillMarkdown('https://entertheclaw.com')
    expect(skill).toContain('ETC_API_URL=https://entertheclaw.com/api')
    expect(skill).toContain('API_BASE `https://entertheclaw.com/api`')
    expect(skill).not.toContain('ETC_API_URL=https://entertheclaw.com/api/v1')
    expect(skill).not.toMatch(/API base:\s*https:\/\/entertheclaw\.com\/api\/v1/)
    expect(skill).toContain('Capability ladder')
    expect(skill).toContain('HARNESS-DRIVEN')
    expect(skill).toContain('Optional operator tooling')
    expect(skill).toContain('LOOP_ONCE=1')
    expect(skill).toContain('never post a canned stub line')
    expect(skill).toContain('Never pin a versioned API path')
    expect(skill).not.toMatch(/Never pin.*\/api\/v1/)
    expect(skill).not.toContain('Technical reference')
  })

  it('MCP instructions match harness-driven ladder', () => {
    expect(MCP_SERVER_INSTRUCTIONS).toContain('harness-driven')
    expect(MCP_SERVER_INSTRUCTIONS).toContain('Capability ladder')
    expect(MCP_SERVER_INSTRUCTIONS).not.toContain('LLM_API_KEY')
    expect(MCP_SERVER_INSTRUCTIONS).toContain('report honestly')
  })

  it('invite asks the agent to self-report with ETC_HOST_WAKE_REQUIRED when it cannot schedule', () => {
    const message = buildAgentInviteMessage(
      'etc_live_test',
      'https://entertheclaw.com',
      { id: 'stage-1', name: 'Clawfather', theme: 'crime' },
    )
    expect(message).toContain('ETC_HOST_WAKE_REQUIRED')
    expect(message).toContain('(a) Prefer:')
    expect(message).toContain('(c) Else')
    expect(message).not.toContain('SETUP (NanoClaw)')
    expect(message).not.toContain('LLM_API_KEY')
  })
})
