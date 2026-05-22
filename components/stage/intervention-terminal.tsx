'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { AUTH_PATH } from '@/lib/auth/paths'

const STAGE_COOLDOWN_MS = 6 * 60 * 1000

interface Props {
  stageId: string
  isLoggedIn: boolean
  /** Timestamp (ms) of the most recent twist on this stage. Null if none yet. */
  lastTwistAt: number | null
  /** Last-twist timestamps locked to this user across all stages (used for the per-user lockout). */
  lastUserTwistAt: number | null
  /** Updated when SSE delivers a new twist so the timer re-syncs without a refetch. */
  liveLastTwistAt: number | null
  /** Optional callback when this user's submission lands locally — used so the parent
   *  can update its own liveLastTwistAt without waiting for the SSE roundtrip. */
  onLocalSubmitSuccess?: () => void
}

type SubmissionState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'won' }
  | { kind: 'lost'; reason: string }
  | { kind: 'error'; message: string }

const USER_COOLDOWN_MS = 60 * 60 * 1000

export function InterventionTerminal({
  stageId,
  isLoggedIn,
  lastTwistAt,
  lastUserTwistAt,
  liveLastTwistAt,
  onLocalSubmitSuccess,
}: Props) {
  const [now, setNow] = useState(() => Date.now())
  const [draft, setDraft] = useState('')
  const [submission, setSubmission] = useState<SubmissionState>({ kind: 'idle' })

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const effectiveLastTwistAt = useMemo(() => {
    const candidates = [lastTwistAt, liveLastTwistAt].filter(
      (v): v is number => typeof v === 'number'
    )
    if (candidates.length === 0) return null
    return Math.max(...candidates)
  }, [lastTwistAt, liveLastTwistAt])

  const stageRemainingMs = effectiveLastTwistAt
    ? Math.max(0, STAGE_COOLDOWN_MS - (now - effectiveLastTwistAt))
    : 0
  const userRemainingMs = lastUserTwistAt
    ? Math.max(0, USER_COOLDOWN_MS - (now - lastUserTwistAt))
    : 0

  const stageLocked = stageRemainingMs > 0
  const userLocked = userRemainingMs > 0
  const canSubmit = isLoggedIn && !stageLocked && !userLocked && submission.kind !== 'submitting'

  const handleSubmit = useCallback(async () => {
    if (!isLoggedIn) {
      window.location.href = `${AUTH_PATH}?callbackUrl=${encodeURIComponent(`/stage/${stageId}`)}`
      return
    }
    const content = draft.trim()
    if (!content) return

    setSubmission({ kind: 'submitting' })
    try {
      const res = await fetch(`/api/v1/twists/${stageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.status === 401) {
        window.location.href = `${AUTH_PATH}?callbackUrl=${encodeURIComponent(`/stage/${stageId}`)}`
        return
      }
      if (res.ok) {
        setSubmission({ kind: 'won' })
        setDraft('')
        onLocalSubmitSuccess?.()
        return
      }
      if (res.status === 429) {
        const body = await res.json().catch(() => null)
        const error = (body as { error?: string } | null)?.error ?? 'cooldown'
        const reason =
          error.includes('User')
            ? "You already twisted recently. Hold for the hour."
            : "Another director got there first. Hold tight until the next window."
        setSubmission({ kind: 'lost', reason })
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setSubmission({
        kind: 'error',
        message: body?.error ?? `Submission failed (HTTP ${res.status})`,
      })
    } catch (err) {
      setSubmission({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Submission failed',
      })
    }
  }, [draft, isLoggedIn, stageId, onLocalSubmitSuccess])

  // After a brief celebration window, drop back to idle (the cooldown timer takes over visually).
  useEffect(() => {
    if (submission.kind === 'won' || submission.kind === 'lost') {
      const t = setTimeout(() => setSubmission({ kind: 'idle' }), 5000)
      return () => clearTimeout(t)
    }
  }, [submission.kind])

  return (
    <aside className="glass-hud pointer-events-auto flex w-80 flex-col gap-5 rounded-sm p-5 shadow-2xl">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#888880]">
            <span>▸</span>
            Intervention Terminal
          </h2>
          <p
            className="mt-1 text-sm italic text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Submit Narrative Twist
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-sm border border-[#C41E3A]/30 bg-[#0e0e0e] px-2 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C41E3A] shadow-[0_0_8px_#C41E3A] animate-pulse-glow" />
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#C41E3A]">Live</span>
        </div>
      </header>

      <CountdownPanel
        stageLocked={stageLocked}
        userLocked={userLocked}
        stageRemainingMs={stageRemainingMs}
        userRemainingMs={userRemainingMs}
      />

      <div className="flex flex-col gap-3">
        <textarea
          className={cn(
            'h-24 w-full resize-none rounded-sm border border-[#242424] bg-[#0e0e0e] p-3 font-mono text-xs text-[#F0EDE8] placeholder:text-[#444440]',
            'focus:border-[#C41E3A]/50 focus:outline-none focus:ring-1 focus:ring-[#C41E3A]/50',
            (!canSubmit || stageLocked) && 'opacity-60'
          )}
          placeholder={
            !isLoggedIn
              ? 'Sign in to inject a narrative directive...'
              : stageLocked
                ? 'Stage is locked — wait for the next window.'
                : userLocked
                  ? 'You twisted recently. Wait for your hour to reset.'
                  : 'Inject narrative directive...'
          }
          value={draft}
          maxLength={500}
          disabled={!canSubmit}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isLoggedIn ? false : !canSubmit || draft.trim().length === 0}
          className={cn(
            'group flex w-full items-center justify-center gap-2 rounded-sm bg-gradient-to-br from-[#C41E3A] to-[#9B1B30] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-[#F0EDE8] shadow-[0_4px_15px_rgba(196,30,58,0.2)] transition-all',
            'hover:shadow-[0_4px_25px_rgba(196,30,58,0.4)]',
            'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-[0_4px_15px_rgba(196,30,58,0.2)]'
          )}
        >
          {submission.kind === 'submitting'
            ? 'Submitting…'
            : !isLoggedIn
              ? 'Sign in to twist ▸'
              : 'Execute Twist ▸'}
        </button>

        <SubmissionStatus state={submission} />
      </div>
    </aside>
  )
}

function CountdownPanel({
  stageLocked,
  userLocked,
  stageRemainingMs,
  userRemainingMs,
}: {
  stageLocked: boolean
  userLocked: boolean
  stageRemainingMs: number
  userRemainingMs: number
}) {
  if (!stageLocked && !userLocked) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-sm border border-[#C41E3A]/30 bg-[#0e0e0e]/80 py-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880]">
          Window Open
        </span>
        <span className="font-mono text-[24px] uppercase tracking-[0.05em] text-[#C41E3A] text-glow-primary">
          Submit Now
        </span>
        <span className="text-[10px] text-[#444440]">First director to submit wins the next 6 minutes.</span>
      </div>
    )
  }

  const ms = stageLocked ? stageRemainingMs : userRemainingMs
  const label = stageLocked ? 'Window Closes In' : 'Your Cooldown'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  return (
    <div className="flex flex-col items-center justify-center rounded-sm border border-[#242424]/40 bg-[#0e0e0e]/80 py-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880]">
        {label}
      </span>
      <div className="mt-1 flex items-baseline gap-1 font-mono text-4xl tracking-tight text-[#F0EDE8] drop-shadow-[0_0_10px_rgba(229,226,225,0.2)]">
        <span>{mm}</span>
        <span className="text-2xl text-[#C41E3A] animate-pulse-live">:</span>
        <span>{ss}</span>
      </div>
    </div>
  )
}

function SubmissionStatus({ state }: { state: SubmissionState }) {
  if (state.kind === 'won') {
    return (
      <div className="rounded-sm border border-[#C41E3A]/40 bg-[#C41E3A]/10 p-3 text-xs text-[#F0EDE8]">
        <span
          className="text-base italic text-[#C41E3A]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          The stage is yours.
        </span>
        <p className="mt-1 text-[#888880]">
          Your twist landed. The stage is locked for the next 6 minutes.
        </p>
      </div>
    )
  }
  if (state.kind === 'lost') {
    return (
      <div className="rounded-sm border border-[#3A3A3A] bg-[#0e0e0e] p-3 text-xs">
        <span
          className="text-base italic text-[#888880]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Curtains.
        </span>
        <p className="mt-1 text-[#888880]">{state.reason}</p>
      </div>
    )
  }
  if (state.kind === 'error') {
    return (
      <p className="text-xs text-[#E8405A]">{state.message}</p>
    )
  }
  return null
}
