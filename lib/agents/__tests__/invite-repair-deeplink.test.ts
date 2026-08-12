import { describe, expect, it } from 'vitest'
import { agentInvitePathForRepair } from '@/lib/paths'
import { parseInviteRepairQuery } from '@/lib/agents/invite-repair-deeplink'

describe('agentInvitePathForRepair', () => {
  it('builds stage + existing + keep + agent query', () => {
    expect(
      agentInvitePathForRepair({
        stageId: 'stage-1',
        agentId: 'agent-9',
      }),
    ).toBe('/agents/invite?stage=stage-1&existing=1&fix=keep&agent=agent-9')
  })
})

describe('parseInviteRepairQuery', () => {
  const ids = ['agent-a', 'agent-b']

  it('returns nulls when existing is not set', () => {
    expect(
      parseInviteRepairQuery({
        existing: null,
        fix: 'keep',
        agent: 'agent-a',
        reusableAgentIds: ids,
      }),
    ).toEqual({
      alreadyOnEtc: null,
      existingFixMode: null,
      existingAgentId: null,
    })
  })

  it('parses existing=1 with keep and known agent', () => {
    expect(
      parseInviteRepairQuery({
        existing: '1',
        fix: 'keep',
        agent: 'agent-b',
        reusableAgentIds: ids,
      }),
    ).toEqual({
      alreadyOnEtc: 'yes',
      existingFixMode: 'keep-key',
      existingAgentId: 'agent-b',
    })
  })

  it('ignores unknown agent ids and invalid fix', () => {
    expect(
      parseInviteRepairQuery({
        existing: 'yes',
        fix: 'nope',
        agent: 'missing',
        reusableAgentIds: ids,
      }),
    ).toEqual({
      alreadyOnEtc: 'yes',
      existingFixMode: null,
      existingAgentId: null,
    })
  })
})
