import { describe, it, expect } from 'vitest'
import mcpPackage from '../../../mcp/package.json'
import {
  ENTERTHECLAW_MCP_NPX_SPEC,
  ENTERTHECLAW_MCP_VERSION,
  mcpUrlFromApiBase,
} from '@/lib/agents/mcp-package-version'
import { buildMcpConfigJson } from '@/lib/agents/participation-prompt'
import { buildAgentInviteMessage } from '@/lib/agents/invite-message'

describe('hosted MCP invite / pulse pin', () => {
  it('re-exports mcp/package.json version for pulse CLI', () => {
    expect(ENTERTHECLAW_MCP_VERSION).toBe(mcpPackage.version)
    expect(ENTERTHECLAW_MCP_NPX_SPEC).toBe(`entertheclaw-mcp@${mcpPackage.version}`)
  })

  it('buildMcpConfigJson uses remote url + bearer header (no npx)', () => {
    const json = buildMcpConfigJson('etc_live_test', 'https://entertheclaw.com/api/v1')
    const parsed = JSON.parse(json) as {
      entertheclaw: { url: string; headers: { Authorization: string }; command?: string }
    }
    expect(parsed.entertheclaw.url).toBe('https://entertheclaw.com/mcp')
    expect(parsed.entertheclaw.headers.Authorization).toBe('Bearer etc_live_test')
    expect(parsed.entertheclaw.command).toBeUndefined()
    expect(mcpUrlFromApiBase('http://localhost:3000/api/v1')).toBe('http://localhost:3000/mcp')
  })

  it('invite uses hosted MCP url and pulse pin (not stdio npx for MCP)', () => {
    const message = buildAgentInviteMessage(
      'etc_live_test',
      'https://entertheclaw.com',
      { id: 'stage-1', name: 'Claw Wars', theme: 'scifi' },
    )
    expect(message).toContain('https://entertheclaw.com/mcp')
    expect(message).toContain('Hosted remote Streamable HTTP')
    expect(message).toContain(`npx -y -p ${ENTERTHECLAW_MCP_NPX_SPEC} entertheclaw-pulse`)
    expect(message).toContain('idempotent')
    expect(message).not.toMatch(/"command"\s*:\s*"npx"/)
    expect(message).not.toContain(`npx ${ENTERTHECLAW_MCP_NPX_SPEC}).`)
  })

  it('localhost invite embeds localhost mcp url', () => {
    const message = buildAgentInviteMessage('etc_live_test', 'http://localhost:3000', null)
    expect(message).toContain('http://localhost:3000/mcp')
    expect(message).not.toContain('https://entertheclaw.com/mcp')
  })
})
