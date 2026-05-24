'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface StageAssignmentOption {
  id: string
  name: string
  theme: string
  mainParticipantCount: number
  npcParticipantCount: number
  maxMainCharacters: number
  maxNpcs: number
}

interface Props {
  agentId: string
  currentStageId: string | null
  currentStageName: string | null
  availableStages: StageAssignmentOption[]
  /** Optional className for the outer container. */
  className?: string
}

type Step = 'idle' | 'picking' | 'confirming'
const SIDELINE = 'none' as const
type Selection = typeof SIDELINE | string

export function StageAssignmentControls({
  agentId,
  currentStageId,
  currentStageName,
  availableStages,
  className,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)

  const onStage = Boolean(currentStageId)

  const pickerStages = useMemo(
    () =>
      availableStages
        .filter((s) => s.id !== currentStageId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [availableStages, currentStageId],
  )

  useEffect(() => {
    if (step !== 'picking' || selection !== null) return
    // On-stage default: sideline. Not-on-stage default: first available stage.
    if (onStage) {
      setSelection(SIDELINE)
    } else {
      const first = pickerStages.find(
        (s) =>
          s.mainParticipantCount < s.maxMainCharacters ||
          s.npcParticipantCount < s.maxNpcs,
      )
      if (first) setSelection(first.id)
    }
  }, [step, selection, onStage, pickerStages])

  function reset() {
    setStep('idle')
    setSelection(null)
    setError(null)
  }

  async function commit() {
    if (!selection) return
    setError(null)
    setBusy(true)
    try {
      const res =
        selection === SIDELINE
          ? await fetch(`/api/v1/agents/${agentId}/stage-assignment`, {
              method: 'DELETE',
            })
          : await fetch(`/api/v1/agents/${agentId}/stage-assignment`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stageId: selection }),
            })
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        throw new Error(body?.error ?? 'Action failed')
      }
      router.refresh()
      setBusy(false)
      reset()
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  // ─── Step 3: confirm ────────────────────────────────────────────────
  if (step === 'confirming' && selection) {
    const targetStage =
      selection === SIDELINE ? null : pickerStages.find((s) => s.id === selection) ?? null

    let title: string
    let detail: string
    let confirmLabel: string
    if (onStage && selection === SIDELINE) {
      title = `Pull this agent from ${currentStageName ?? 'the current stage'}?`
      detail =
        'The current character will be archived to history and the agent will be sidelined (not on any stage).'
      confirmLabel = 'Pull from stage'
    } else if (onStage && targetStage) {
      title = `Move this agent from ${currentStageName ?? 'the current stage'} to ${targetStage.name}?`
      detail =
        'The current character will be archived to history and a new character will be created on the new stage.'
      confirmLabel = `Move to ${targetStage.name}`
    } else if (!onStage && targetStage) {
      title = `Assign this agent to ${targetStage.name}?`
      detail = 'A new character will be created on the stage.'
      confirmLabel = `Assign to ${targetStage.name}`
    } else {
      // Defensive — shouldn't reach here.
      reset()
      return null
    }

    return (
      <div className={cn('space-y-3 rounded-md border border-[#242424] bg-[#0E0E0E] p-4', className)}>
        <p className="text-sm font-medium text-[#F0EDE8]">{title}</p>
        <p className="text-xs text-[#888880]">{detail}</p>
        {error && <p className="text-sm text-[#C41E3A]">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" disabled={busy} onClick={commit}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setError(null)
              setStep('picking')
            }}
          >
            Back
          </Button>
        </div>
      </div>
    )
  }

  // ─── Step 2: pick destination ───────────────────────────────────────
  if (step === 'picking') {
    return (
      <div className={cn('space-y-3 rounded-md border border-[#242424] bg-[#0E0E0E] p-4', className)}>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
          {onStage ? 'Pull and reassign to…' : 'Assign to a stage'}
        </p>
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {onStage && (
            <li key="__sideline">
              <button
                type="button"
                onClick={() => setSelection(SIDELINE)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded border px-3 py-2 text-left text-sm transition-colors',
                  selection === SIDELINE
                    ? 'border-[#C41E3A] bg-[#1A0F12] text-[#F0EDE8]'
                    : 'border-[#242424] text-[#F0EDE8] hover:border-[#3A3A3A] hover:bg-[#161616]',
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="block truncate font-medium">No new stage (sideline)</span>
                  <span className="block text-xs text-[#888880]">
                    Pull from current stage and archive the character.
                  </span>
                </span>
              </button>
            </li>
          )}
          {pickerStages.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[#888880]">
              No other active stages available.
            </li>
          ) : (
            pickerStages.map((stage) => {
              const mainOpen = stage.mainParticipantCount < stage.maxMainCharacters
              const npcOpen = stage.npcParticipantCount < stage.maxNpcs
              const full = !mainOpen && !npcOpen
              const selected = selection === stage.id
              return (
                <li key={stage.id}>
                  <button
                    type="button"
                    disabled={full}
                    onClick={() => setSelection(stage.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded border px-3 py-2 text-left text-sm transition-colors',
                      full
                        ? 'cursor-not-allowed border-[#242424] text-[#444440]'
                        : selected
                          ? 'border-[#C41E3A] bg-[#1A0F12] text-[#F0EDE8]'
                          : 'border-[#242424] text-[#F0EDE8] hover:border-[#3A3A3A] hover:bg-[#161616]',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="block truncate font-medium">{stage.name}</span>
                      <span className="block text-xs text-[#888880]">
                        {stage.theme} ·{' '}
                        {full
                          ? 'Full'
                          : mainOpen
                            ? `Main ${stage.mainParticipantCount}/${stage.maxMainCharacters}`
                            : `NPC ${stage.npcParticipantCount}/${stage.maxNpcs}`}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
        {error && <p className="text-sm text-[#C41E3A]">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={!selection}
            onClick={() => {
              setError(null)
              setStep('confirming')
            }}
          >
            Next
          </Button>
          <Button size="sm" variant="secondary" onClick={reset}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // ─── Step 1: entry button ───────────────────────────────────────────
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <Button
        size="sm"
        variant="primary"
        onClick={() => setStep('picking')}
      >
        {onStage ? 'Pull from stage' : 'Assign to a stage'}
      </Button>
      {error && <span className="self-center text-xs text-[#C41E3A]">{error}</span>}
    </div>
  )
}
