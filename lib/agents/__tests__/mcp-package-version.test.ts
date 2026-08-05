import { describe, it, expect } from 'vitest'
import mcpPackage from '../../../mcp/package.json'
import {
  ENTERTHECLAW_MCP_NPX_SPEC,
  ENTERTHECLAW_MCP_VERSION,
  mcpUrlFromApiBase,
} from '@/lib/agents/mcp-package-version'
import { buildMcpConfigJson, buildSkillMarkdown } from '@/lib/agents/participation-prompt'
import { buildAgentInviteMessage } from '@/lib/agents/invite-message'

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

  it('invite uses unversioned API_BASE and puts stage fields in CREDENTIALS', () => {
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
    expect(message).toContain('REQUIRED — schedule a RECURRING wake')
    expect(message).toContain('entertheclaw-pulse')
    expect(message).toContain(
      'ETC_API_KEY=etc_live_<YOUR_KEY> ETC_API_URL=https://entertheclaw.com/api ETC_STAGE_ID=<STAGE_ID>',
    )
    expect(message).toContain('npx -y -p entertheclaw-mcp entertheclaw-pulse')
    expect(message).not.toMatch(/entertheclaw-mcp@/)
    // Stage URL lives in CREDENTIALS, not a free-floating prose block after.
    const credSection = message.slice(
      message.indexOf('=== CREDENTIALS ==='),
      message.indexOf('=== MCP'),
    )
    expect(credSection).toContain('STAGE_URL')
    expect(message.indexOf('STAGE_URL')).toBeLessThan(message.indexOf('=== MCP'))
  })

  it('skill teaches unversioned ETC_API_URL=/api', () => {
    const skill = buildSkillMarkdown('https://entertheclaw.com')
    expect(skill).toContain('ETC_API_URL=https://entertheclaw.com/api')
    expect(skill).toContain('API_BASE `https://entertheclaw.com/api`')
    expect(skill).not.toContain('ETC_API_URL=https://entertheclaw.com/api/v1')
    expect(skill).not.toMatch(/API base:\s*https:\/\/entertheclaw\.com\/api\/v1/)
  })

  it('localhost invite embeds localhost unversioned api + mcp', () => {
    const message = buildAgentInviteMessage('etc_live_test', 'http://localhost:3000', null)
    expect(message).toContain('API_BASE   = http://localhost:3000/api')
    expect(message).toContain('MCP_URL    = http://localhost:3000/mcp')
    expect(message).toContain('STAGE_ID   = <STAGE_ID>')
    expect(message).not.toContain('/api/v1')
    expect(message).not.toContain('https://entertheclaw.com/mcp')
  })
})
