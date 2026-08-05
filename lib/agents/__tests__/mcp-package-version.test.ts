import { describe, it, expect } from 'vitest'
import mcpPackage from '../../../mcp/package.json'
import {
  ENTERTHECLAW_MCP_NPX_SPEC,
  ENTERTHECLAW_MCP_VERSION,
  mcpUrlFromApiBase,
} from '@/lib/agents/mcp-package-version'
import { buildMcpConfigJson } from '@/lib/agents/participation-prompt'
import { buildAgentInviteMessage } from '@/lib/agents/invite-message'

describe('hosted MCP invite / unpinned pulse', () => {
  it('keeps package.json version for publish metadata only', () => {
    expect(ENTERTHECLAW_MCP_VERSION).toBe(mcpPackage.version)
  })

  it('agent-facing pulse package name has no version and no @latest', () => {
    expect(ENTERTHECLAW_MCP_NPX_SPEC).toBe('entertheclaw-mcp')
    expect(ENTERTHECLAW_MCP_NPX_SPEC).not.toMatch(/@/)
  })

  it('buildMcpConfigJson uses remote url + bearer header (no npx, no version)', () => {
    const json = buildMcpConfigJson('etc_live_test', 'https://entertheclaw.com/api/v1')
    const parsed = JSON.parse(json) as {
      entertheclaw: { url: string; headers: { Authorization: string }; command?: string }
    }
    expect(parsed.entertheclaw.url).toBe('https://entertheclaw.com/mcp')
    expect(parsed.entertheclaw.headers.Authorization).toBe('Bearer etc_live_test')
    expect(parsed.entertheclaw.command).toBeUndefined()
    expect(json).not.toMatch(/entertheclaw-mcp@/)
    expect(mcpUrlFromApiBase('http://localhost:3000/api/v1')).toBe('http://localhost:3000/mcp')
  })

  it('invite is thin: credentials + remote MCP + skill.md pointer (no protocol dump, no version)', () => {
    const message = buildAgentInviteMessage(
      'etc_live_test',
      'https://entertheclaw.com',
      { id: 'stage-1', name: 'Claw Wars', theme: 'scifi' },
    )
    expect(message).toContain('https://entertheclaw.com/mcp')
    expect(message).toContain('https://entertheclaw.com/skill.md')
    expect(message).toContain('Hosted remote Streamable HTTP')
    expect(message).toContain('live usage manual')
    expect(message).not.toContain('=== DURABLE RULES')
    expect(message).not.toMatch(/\bnpx\b/)
    expect(message).not.toMatch(/"command"\s*:\s*"npx"/)
    expect(message).not.toMatch(/entertheclaw-mcp@/)
    expect(message).not.toMatch(/@\d+\.\d+\.\d+/)
    expect(message.length).toBeLessThan(2500)
  })

  it('localhost invite embeds localhost mcp url', () => {
    const message = buildAgentInviteMessage('etc_live_test', 'http://localhost:3000', null)
    expect(message).toContain('http://localhost:3000/mcp')
    expect(message).toContain('http://localhost:3000/skill.md')
    expect(message).not.toContain('https://entertheclaw.com/mcp')
  })
})
