'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { AUTH_PATH } from '@/lib/auth/paths'
import type { ActiveTwist } from './active-twist'
import type { FeedItem } from '@/lib/stage/feed-items'
import { TwistHistoryModal } from './twist-history-modal'

const STAGE_COOLDOWN_MS = 6 * 60 * 1000
const USER_COOLDOWN_MS = 60 * 60 * 1000

interface Props {
  stageId: string
  stageName: string
  isLoggedIn: boolean
  lastTwistAt: number | null
  lastUserTwistAt: number | null
  liveLastTwistAt: number | null
  onLocalSubmitSuccess?: () => void
  activeTwist: ActiveTwist | null
  recentTwists: FeedItem[]
  twistCount: number
  feedBumpKey: number
  collapsible?: boolean
  defaultOpen?: boolean
}

type SubmissionState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'won' }
  | { kind: 'lost'; reason: string }
  | { kind: 'error'; message: string }

export function NarrativeTwist({
  stageId,
  stageName,
  isLoggedIn,
  lastTwistAt,
  lastUserTwistAt,
  liveLastTwistAt,
  onLocalSubmitSuccess,
  recentTwists,
  twistCount,
  feedBumpKey,
  collapsible = false,
  defaultOpen = true,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(defaultOpen)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [draft, setDraft] = useState('')
  const [submission, setSubmission] = useState<SubmissionState>({ kind: 'idle' })

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const effectiveLastTwistAt = useMemo(() => {
    const candidates = [lastTwistAt, liveLastTwistAt].filter(
      (v): v is number => typeof v === 'number',
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
  const windowOpen = !stageLocked && !userLocked

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
        const reason = error.includes('User')
          ? 'You already twisted recently. Hold for the hour.'
          : 'Another director got there first. Hold tight until the next window.'
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

  useEffect(() => {
    if (submission.kind === 'won' || submission.kind === 'lost') {
      const t = setTimeout(() => setSubmission({ kind: 'idle' }), 5000)
      return () => clearTimeout(t)
    }
  }, [submission.kind])

  const body = (
    <>
      {/* Submit form — at the top */}
      <div className="flex flex-col gap-2">
        <CountdownLine
          stageLocked={stageLocked}
          userLocked={userLocked}
          stageRemainingMs={stageRemainingMs}
          userRemainingMs={userRemainingMs}
        />
        <textarea
          className={cn(
            'h-20 w-full resize-none rounded-sm border border-[#242424]/70 bg-[#0e0e0e]/80 p-2.5 font-mono text-xs text-[#F0EDE8] placeholder:text-[#444440]',
            'focus:border-[#C41E3A]/60 focus:outline-none focus:ring-1 focus:ring-[#C41E3A]/40',
            (!canSubmit || stageLocked) && 'opacity-60',
          )}
          placeholder={
            !isLoggedIn
              ? 'Sign in to inject a twist…'
              : stageLocked
                ? 'Stage is locked — wait for the next window.'
                : userLocked
                  ? 'You twisted recently. Wait for your hour to reset.'
                  : 'Inject narrative directive…'
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
            'inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm bg-[#C41E3A] px-4 font-mono text-xs font-medium uppercase tracking-[0.15em] text-[#F0EDE8] transition-all',
            'hover:bg-[#9B1B30] hover:shadow-[0_0_18px_rgba(196,30,58,0.35)]',
            'disabled:cursor-not-allowed disabled:bg-[#161616] disabled:text-[#444440] disabled:shadow-none',
          )}
        >
          {submission.kind === 'submitting'
            ? 'Submitting…'
            : !isLoggedIn
              ? 'Sign in to twist'
              : 'Submit Twist'}
        </button>
        <SubmissionStatus state={submission} />
      </div>

      {/* History — always shown, no toggle, up to 5 recent twists */}
      {recentTwists.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-[#242424]/50 pt-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#444440]">
            Recent · {twistCount} twist{twistCount !== 1 ? 's' : ''}
          </p>
          <ul key={feedBumpKey} className="flex flex-col gap-2" aria-label="Recent twists">
            {recentTwists.map((item, index) => {
              if (item.kind !== 'twist') return null
              return (
                <li
                  key={item.id}
                  className="stage-feed-enter font-mono text-[11px] italic leading-relaxed text-[#B8860B]/90"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <span className="not-italic text-[#888880]">{item.userDisplayName}:</span>{' '}
                  "{item.text}"
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex w-fit font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline"
          >
            Full history
          </button>
        </div>
      )}
    </>
  )

  if (collapsible) {
    return (
      <>
        <aside className="glass-hud pointer-events-auto w-full rounded-sm border-l-2 border-l-[#C41E3A]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 p-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <h2
                className="shrink-0 text-[20px] font-light italic leading-none tracking-[-0.02em] text-[#F0EDE8]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Narrative Twist
              </h2>
              {windowOpen && (
                <span className="relative flex h-1.5 w-1.5 shrink-0" aria-label="Window open">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C41E3A] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#C41E3A] shadow-[0_0_6px_#C41E3A]" />
                </span>
              )}
            </div>
            <span
              className={cn(
                'shrink-0 text-[10px] text-[#444440] transition-transform',
                panelOpen && 'rotate-180',
              )}
            >
              ▾
            </span>
          </button>

          {panelOpen && (
            <div className="flex flex-col gap-2.5 px-3 pb-3">
              {body}
            </div>
          )}
        </aside>

        <TwistHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          stageId={stageId}
          stageName={stageName}
          initialItems={recentTwists}
        />
      </>
    )
  }

  return (
    <>
      <aside className="glass-hud pointer-events-auto flex w-full flex-col gap-2.5 rounded-sm border-l-2 border-l-[#C41E3A]/70 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <header className="flex items-baseline justify-between gap-3">
          <h2
            className="text-[20px] font-light italic leading-none tracking-[-0.02em] text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Narrative Twist
          </h2>
          {windowOpen && (
            <span className="relative flex h-1.5 w-1.5" aria-label="Window open">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C41E3A] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#C41E3A] shadow-[0_0_6px_#C41E3A]" />
            </span>
          )}
        </header>
        {body}
      </aside>

      <TwistHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        stageId={stageId}
        stageName={stageName}
        initialItems={recentTwists}
      />
    </>
  )
}

function CountdownLine({
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
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#888880]">
        Window open — <span className="text-[#C41E3A]">submit now</span>
      </p>
    )
  }

  const ms = stageLocked ? stageRemainingMs : userRemainingMs
  const label = stageLocked ? 'Window closes in' : 'Your cooldown'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  return (
    <p className="flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#888880]">
      <span>{label}</span>
      <span className="text-[18px] tracking-[0.05em] text-[#F0EDE8]">
        {mm}
        <span className="text-[#C41E3A]">:</span>
        {ss}
      </span>
    </p>
  )
}

function SubmissionStatus({ state }: { state: SubmissionState }) {
  if (state.kind === 'won') {
    return (
      <p className="text-xs text-[#F0EDE8]">
        <span
          className="italic text-[#C41E3A]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          The stage is yours.
        </span>{' '}
        <span className="text-[#888880]">Locked for 6 minutes.</span>
      </p>
    )
  }
  if (state.kind === 'lost') {
    return <p className="text-xs text-[#888880]">{state.reason}</p>
  }
  if (state.kind === 'error') {
    return <p className="text-xs text-[#E8405A]">{state.message}</p>
  }
  return null
}
