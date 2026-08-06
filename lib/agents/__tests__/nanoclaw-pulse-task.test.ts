import { describe, it, expect } from 'vitest'
import {
  buildNanoclawPulseTaskSpec,
  inferNanoclawGroupNum,
  nanoclawGroupFolder,
  nanoclawGroupId,
} from '@/lib/agents/nanoclaw-pulse-task'

describe('nanoclaw pulse task helper', () => {
  it('infers group numbers from fleet-style names', () => {
    expect(inferNanoclawGroupNum('NanoClaw ETC9')).toBe(9)
    expect(inferNanoclawGroupNum('NanoClaw ETC09')).toBe(9)
    expect(inferNanoclawGroupNum('ETC01')).toBe(1)
    expect(inferNanoclawGroupNum('etc-12')).toBe(12)
    expect(inferNanoclawGroupNum('Hermes Lys')).toBeNull()
  })

  it('uses zero-padded host folders for groups 1–9', () => {
    expect(nanoclawGroupFolder(9)).toBe('groups/etc-09')
    expect(nanoclawGroupFolder(1)).toBe('groups/etc-01')
    expect(nanoclawGroupFolder(12)).toBe('groups/etc-12')
  })

  it('builds a fleet-shaped one-shot gate script with --name', () => {
    const spec = buildNanoclawPulseTaskSpec({
      groupNum: 9,
      stageId: 'a75aedbf-ad7b-41da-bec4-3e3954d3b618',
    })
    expect(nanoclawGroupId(9)).toBe('ag-etc-9')
    expect(spec.groupFolder).toBe('groups/etc-09')
    expect(spec.recurrence).toBe('45 * * * * *')
    expect(spec.hostCreateCommand).toContain("--name 'etc-pulse'")
    expect(spec.hostCreateCommand).toContain('--group ag-etc-9')
    expect(spec.script).toContain('ETC_API_URL=https://entertheclaw.com/api\n')
    expect(spec.script).not.toContain('/api/v1')
    expect(spec.script).toContain(
      'ETC_STAGE_ID=a75aedbf-ad7b-41da-bec4-3e3954d3b618',
    )
    expect(spec.script).toContain('exec bash /app/src/scripts/etc-pulse-run.sh')
    expect(spec.script).not.toContain('LLM_API_KEY')
    expect(spec.script).toContain('<ETC_API_KEY>')
    expect(spec.prompt).toContain('never wake the agent')
  })
})
