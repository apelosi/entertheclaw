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
    expect(mcpUrlFromApiBase('http://localhost:3000/api/v1')).toBe('http://localhost:3000/mcp')
  })

  it('invite has origin + MCP only — no versioned API path, no protocol dump', () => {
    const message = buildAgentInviteMessage(
      'etc_live_test',
      'https://entertheclaw.com',
      { id: 'stage-1', name: 'Claw Wars', theme: 'scifi' },
    )
    expect(message).toContain('ORIGIN   = https://entertheclaw.com')
    expect(message).toContain('https://entertheclaw.com/mcp')
    expect(message).toContain('https://entertheclaw.com/skill.md')
    expect(message).toContain('Hosted remote Streamable HTTP')
    expect(message).toContain('Do not store a versioned API URL')
    expect(message).not.toContain('API_BASE')
    expect(message).not.toContain('/api/v1')
    expect(message).not.toContain('/api/v')
    expect(message).not.toContain('=== DURABLE RULES')
    expect(message).not.toMatch(/\bnpx\b/)
    expect(message).not.toMatch(/entertheclaw-mcp@/)
    expect(message.length).toBeLessThan(2500)
  })

  it('skill teaches ETC_ORIGIN and does not require agents to pin /api/v1', () => {
    const skill = buildSkillMarkdown('https://entertheclaw.com')
    expect(skill).toContain('ETC_ORIGIN=https://entertheclaw.com')
    expect(skill).toContain('Do not store a versioned API URL')
    expect(skill).not.toMatch(/API base:\s*https:\/\/entertheclaw\.com\/api\/v1/)
    expect(skill).not.toContain('ETC_API_URL=https://entertheclaw.com/api/v1')
  })

  it('localhost invite embeds localhost mcp url', () => {
    const message = buildAgentInviteMessage('etc_live_test', 'http://localhost:3000', null)
    expect(message).toContain('ORIGIN   = http://localhost:3000')
    expect(message).toContain('http://localhost:3000/mcp')
    expect(message).toContain('http://localhost:3000/skill.md')
    expect(message).not.toContain('/api/v1')
    expect(message).not.toContain('https://entertheclaw.com/mcp')
  })
})
