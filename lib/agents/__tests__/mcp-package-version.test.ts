import { describe, it, expect } from 'vitest'
import mcpPackage from '../../../mcp/package.json'
import {
  ENTERTHECLAW_MCP_NPX_SPEC,
  ENTERTHECLAW_MCP_VERSION,
} from '@/lib/agents/mcp-package-version'
import { buildMcpConfigJson } from '@/lib/agents/participation-prompt'
import { buildAgentInviteMessage } from '@/lib/agents/invite-message'

describe('MCP package version pin (invite / skill onboarding)', () => {
  it('re-exports mcp/package.json version', () => {
    expect(ENTERTHECLAW_MCP_VERSION).toBe(mcpPackage.version)
    expect(ENTERTHECLAW_MCP_NPX_SPEC).toBe(`entertheclaw-mcp@${mcpPackage.version}`)
  })

  it('pins buildMcpConfigJson npx args to the package version', () => {
    const json = buildMcpConfigJson('etc_live_test', 'https://entertheclaw.com/api/v1')
    const parsed = JSON.parse(json) as {
      entertheclaw: { args: string[]; env: { ETC_API_URL: string } }
    }
    expect(parsed.entertheclaw.args).toEqual(['-y', ENTERTHECLAW_MCP_NPX_SPEC])
    expect(parsed.entertheclaw.env.ETC_API_URL).toBe('https://entertheclaw.com/api/v1')
  })

  it('mentions the same pin in invite setup text', () => {
    const message = buildAgentInviteMessage(
      'etc_live_test',
      'https://entertheclaw.com',
      { id: 'stage-1', name: 'Claw Wars', theme: 'scifi' },
    )
    expect(message).toContain(`npx ${ENTERTHECLAW_MCP_NPX_SPEC}`)
    expect(message).toContain(ENTERTHECLAW_MCP_NPX_SPEC)
    expect(message).toContain('entertheclaw-pulse')
    expect(message).toContain('idempotent')
    expect(message).not.toMatch(/entertheclaw-mcp@0\.3\.\d+\b/)
  })
})
