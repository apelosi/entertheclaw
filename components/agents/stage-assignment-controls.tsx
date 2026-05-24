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

type Mode = 'idle' | 'picking' | 'pulling' | 'assigning' | 'confirming-pull'

export function StageAssignmentControls({
  agentId,
  currentStageId,
  currentStageName,
  availableStages,
  className,
}: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('idle')
  const [error, setError] = useState<string | null>(null)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'picking' && !selectedStageId) {
      const first = availableStages.find(
        (s) =>
          s.id !== currentStageId &&
          (s.mainParticipantCount < s.maxMainCharacters ||
            s.npcParticipantCount < s.maxNpcs),
      )
      if (first) setSelectedStageId(first.id)
    }
  }, [mode, selectedStageId, availableStages, currentStageId])

  const onStage = Boolean(currentStageId)

  const pickerStages = useMemo(
    () =>
      availableStages
        .filter((s) => s.id !== currentStageId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [availableStages, currentStageId],
  )

  async function handlePull() {
    setError(null)
    setMode('pulling')
    try {
      const res = await fetch(`/api/v1/agents/${agentId}/stage-assignment`, {
        method: 'DELETE',
      })
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        throw new Error(body?.error ?? 'Failed to pull from stage')
      }
      router.refresh()
      setMode('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setMode('confirming-pull')
    }
  }

  async function handleAssign(stageId: string) {
    setError(null)
    setMode('assigning')
    try {
      const res = await fetch(`/api/v1/agents/${agentId}/stage-assignment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId }),
      })
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        throw new Error(body?.error ?? 'Failed to assign to stage')
      }
      router.refresh()
      setMode('idle')
      setSelectedStageId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setMode('picking')
    }
  }

  if (mode === 'confirming-pull') {
    return (
      <div className={cn('space-y-3 rounded-md border border-[#242424] bg-[#0E0E0E] p-4', className)}>
        <p className="text-sm text-[#F0EDE8]">
          Pull this agent from{' '}
          <span className="font-semibold">{currentStageName ?? 'the current stage'}</span>?
          The character will be archived.
        </p>
        {error && <p className="text-sm text-[#C41E3A]">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={handlePull}>
            Pull from stage
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setError(null)
              setMode('idle')
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  if (mode === 'picking') {
    return (
      <div className={cn('space-y-3 rounded-md border border-[#242424] bg-[#0E0E0E] p-4', className)}>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
          {onStage ? 'Move to another stage' : 'Assign to a stage'}
        </p>
        {pickerStages.length === 0 ? (
          <p className="text-sm text-[#888880]">No other active stages available.</p>
        ) : (
          <ul className="max-h-60 space-y-1 overflow-y-auto">
            {pickerStages.map((stage) => {
              const mainOpen = stage.mainParticipantCount < stage.maxMainCharacters
              const npcOpen = stage.npcParticipantCount < stage.maxNpcs
              const full = !mainOpen && !npcOpen
              const selected = selectedStageId === stage.id
              return (
                <li key={stage.id}>
                  <button
                    type="button"
                    disabled={full}
                    onClick={() => setSelectedStageId(stage.id)}
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
            })}
          </ul>
        )}
        {error && <p className="text-sm text-[#C41E3A]">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={!selectedStageId}
            onClick={() => {
              if (selectedStageId) handleAssign(selectedStageId)
            }}
          >
            {onStage ? 'Move' : 'Assign'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setError(null)
              setSelectedStageId(null)
              setMode('idle')
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  const busy = mode === 'pulling' || mode === 'assigning'

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {onStage ? (
        <>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => setMode('picking')}
          >
            Move to another stage
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setMode('confirming-pull')}
          >
            Pull from stage
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => setMode('picking')}
        >
          Assign to a stage
        </Button>
      )}
      {busy && (
        <span className="self-center text-xs text-[#888880]">Working…</span>
      )}
      {error && (
        <span className="self-center text-xs text-[#C41E3A]">{error}</span>
      )}
    </div>
  )
}
