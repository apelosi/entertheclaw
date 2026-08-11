import { describe, expect, it } from 'vitest'
import {
  canProceedExistingFix,
  defaultExistingAgentId,
  showEarlyExistingAgentPicker,
} from '@/lib/agents/invite-existing-agent-selection'

describe('invite-existing-agent-selection', () => {
  it('defaults to the first reusable agent id', () => {
    expect(defaultExistingAgentId([])).toBeNull()
    expect(
      defaultExistingAgentId([
        { id: 'a1' },
        { id: 'a2' },
      ]),
    ).toBe('a1')
  })

  it('shows the early picker only on Yes before paste is ready', () => {
    expect(
      showEarlyExistingAgentPicker({ alreadyOnEtc: null, pasteReady: false }),
    ).toBe(false)
    expect(
      showEarlyExistingAgentPicker({ alreadyOnEtc: 'no', pasteReady: false }),
    ).toBe(false)
    expect(
      showEarlyExistingAgentPicker({ alreadyOnEtc: 'yes', pasteReady: false }),
    ).toBe(true)
    expect(
      showEarlyExistingAgentPicker({ alreadyOnEtc: 'yes', pasteReady: true }),
    ).toBe(false)
  })

  it('gates Keep/Replace on a selected agent id', () => {
    expect(canProceedExistingFix(null)).toBe(false)
    expect(canProceedExistingFix('')).toBe(false)
    expect(canProceedExistingFix('agent-1')).toBe(true)
  })
})
