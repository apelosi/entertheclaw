import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEtcApiClient } from '@/lib/mcp/api-client'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('createEtcApiClient retry policy', () => {
  it('does not retry turn claims on transient failures', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'upstream flake' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const api = createEtcApiClient('https://entertheclaw.com/api/v1', 'etc_live_test')
    const result = await api.claimTurn('stage-1', { stake: 5 })

    expect(result.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries GET requests on transient gateway errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Bad gateway' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ stages: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const api = createEtcApiClient('https://entertheclaw.com/api/v1', 'etc_live_test')
    const result = await api.listStages()

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
