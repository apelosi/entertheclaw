import { describe, expect, it } from 'vitest'
import {
  apiBaseFromOrigin,
  mcpUrlFromOrigin,
  originFromApiBase,
  originFromRequest,
} from '@/lib/mcp/origin'

describe('mcp origin helpers', () => {
  it('builds mcp and api URLs from origin', () => {
    expect(mcpUrlFromOrigin('https://entertheclaw.com')).toBe('https://entertheclaw.com/mcp')
    expect(apiBaseFromOrigin('http://localhost:3000')).toBe('http://localhost:3000/api/v1')
    expect(originFromApiBase('https://entertheclaw.com/api/v1')).toBe('https://entertheclaw.com')
  })

  it('prefers x-forwarded-* over req.url host', () => {
    const req = new Request('http://internal:8080/mcp', {
      headers: {
        'x-forwarded-host': 'staging--example.netlify.app',
        'x-forwarded-proto': 'https',
      },
    })
    expect(originFromRequest(req)).toBe('https://staging--example.netlify.app')
  })

  it('uses http for localhost host header', () => {
    const req = new Request('http://127.0.0.1:3000/mcp', {
      headers: { host: 'localhost:3000' },
    })
    expect(originFromRequest(req)).toBe('http://localhost:3000')
  })

  it('ignores untrusted forwarded host and keeps direct origin', () => {
    const req = new Request('https://entertheclaw.com/mcp', {
      headers: {
        'x-forwarded-host': 'evil.example',
        'x-forwarded-proto': 'https',
      },
    })
    expect(originFromRequest(req)).toBe('https://entertheclaw.com')
  })

  it('falls back to default site origin for untrusted direct host', () => {
    const req = new Request('https://evil.example/mcp')
    expect(originFromRequest(req)).toBe('https://entertheclaw.com')
  })
})
