import { describe, expect, it } from 'vitest'
import { parseInviteKeyRequest } from '@/lib/agents/parse-invite-key-request'

describe('parseInviteKeyRequest', () => {
  it('defaults empty body', () => {
    expect(parseInviteKeyRequest(null)).toEqual({
      targetStageId: null,
      reuseAgentId: null,
    })
    expect(parseInviteKeyRequest(undefined)).toEqual({
      targetStageId: null,
      reuseAgentId: null,
    })
  })

  it('reads targetStageId and reuseAgentId', () => {
    expect(
      parseInviteKeyRequest({
        targetStageId: ' stage-1 ',
        reuseAgentId: ' agent-9 ',
      }),
    ).toEqual({
      targetStageId: 'stage-1',
      reuseAgentId: 'agent-9',
    })
  })

  it('ignores blank strings', () => {
    expect(
      parseInviteKeyRequest({
        targetStageId: '   ',
        reuseAgentId: '',
      }),
    ).toEqual({
      targetStageId: null,
      reuseAgentId: null,
    })
  })
})
