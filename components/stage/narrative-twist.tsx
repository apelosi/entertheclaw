'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { AUTH_PATH } from '@/lib/auth/paths'
import type { ActiveTwist } from './active-twist'
import type { FeedItem } from '@/lib/stage/feed-items'
import { SectionCollapsibleHeader } from './section-collapsible-header'
import {
  LINK_MICRO,
  MONO_LABEL,
  PANEL_COLLAPSIBLE_INSET,
  PANEL_INSET,
  PANEL_STACK_GAP,
  SECTION_HEADER_GAP,
  SECTION_TITLE,
} from './stage-mobile-classes'
import { TwistHistoryModal } from './twist-history-modal'

const STAGE_COOLDOWN_MS = 6 * 60 * 1000
const USER_COOLDOWN_MS = 60 * 60 * 1000

interface Props {
  stageId: string
  stageName: string
  isLoggedIn: boolean
  /** False when stage is inactive or has no characters on stage yet. */
  twistsEnabled: boolean
  lastTwistAt: number | null
  lastUserTwistAt: number | null
  liveLastTwistAt: number | null
  onLocalSubmitSuccess?: () => void
  activeTwist: ActiveTwist | null
  recentTwists: FeedItem[]
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
  twistsEnabled,
  lastTwistAt,
  lastUserTwistAt,
  liveLastTwistAt,
  onLocalSubmitSuccess,
  recentTwists,
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

  const stageRemainingMs =
    twistsEnabled && effectiveLastTwistAt
      ? Math.max(0, STAGE_COOLDOWN_MS - (now - effectiveLastTwistAt))
      : 0
  const userRemainingMs =
    twistsEnabled && lastUserTwistAt
      ? Math.max(0, USER_COOLDOWN_MS - (now - lastUserTwistAt))
      : 0

  const stageLocked = twistsEnabled && stageRemainingMs > 0
  const userLocked = twistsEnabled && userRemainingMs > 0
  const canSubmit =
    twistsEnabled &&
    isLoggedIn &&
    !stageLocked &&
    !userLocked &&
    submission.kind !== 'submitting'
  const windowOpen = twistsEnabled && !stageLocked && !userLocked

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
      <div className="flex flex-col gap-2 max-md:gap-1.5">
        <textarea
          className={cn(
            'h-20 w-full resize-none rounded-sm border border-[#242424]/70 bg-[#0e0e0e]/80 p-2.5 font-mono text-xs text-[#F0EDE8] placeholder:text-[#444440] max-md:h-16 max-md:p-2 max-md:text-[11px]',
            'focus:border-[#C41E3A]/60 focus:outline-none focus:ring-1 focus:ring-[#C41E3A]/40',
            (!twistsEnabled || !canSubmit || stageLocked) && 'opacity-60',
          )}
          placeholder={
            !twistsEnabled
              ? 'Twists unlock when characters join the stage.'
              : !isLoggedIn
                ? 'Sign in to inject a twist…'
                : stageLocked
                  ? 'Stage is locked — wait for the next window.'
                  : userLocked
                    ? 'You twisted recently. Wait for your hour to reset.'
                    : 'Inject narrative directive…'
          }
          value={draft}
          maxLength={500}
          disabled={!twistsEnabled || !canSubmit}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={
            !twistsEnabled || (!isLoggedIn ? false : !canSubmit || draft.trim().length === 0)
          }
          className={cn(
            'inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm bg-[#C41E3A] px-4 font-mono text-xs font-medium uppercase tracking-[0.15em] text-[#F0EDE8] transition-all max-md:h-8 max-md:px-3 max-md:text-[11px]',
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

      <button
        type="button"
        onClick={() => setHistoryOpen(true)}
        className={cn(
          LINK_MICRO,
          'inline-flex w-fit text-[#888880] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline',
        )}
      >
        Twist History
      </button>
    </>
  )

  if (collapsible) {
    return (
      <>
        <aside
          className={cn(
            'glass-hud pointer-events-auto w-full rounded-sm border-l-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)]',
            twistsEnabled ? 'border-l-[#C41E3A]/70' : 'border-l-[#444440]/50 opacity-70',
          )}
        >
          <SectionCollapsibleHeader
            title="Twists"
            titleClassName={twistsEnabled ? undefined : 'text-[#888880]'}
            meta={
              <HeaderStatus
                twistsEnabled={twistsEnabled}
                windowOpen={windowOpen}
                stageLocked={stageLocked}
                userLocked={userLocked}
                stageRemainingMs={stageRemainingMs}
                userRemainingMs={userRemainingMs}
              />
            }
            open={panelOpen}
            onClick={() => setPanelOpen((v) => !v)}
            ariaLabelExpanded="Collapse twists"
            ariaLabelCollapsed="Expand twists"
            className={PANEL_COLLAPSIBLE_INSET}
          />

          {panelOpen && (
            <div className={cn('flex flex-col', PANEL_STACK_GAP, PANEL_INSET)}>
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
      <aside
        className={cn(
          'glass-hud pointer-events-auto flex w-full flex-col rounded-sm border-l-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)]',
          PANEL_STACK_GAP,
          PANEL_COLLAPSIBLE_INSET,
          twistsEnabled ? 'border-l-[#C41E3A]/70' : 'border-l-[#444440]/50 opacity-70',
        )}
      >
        <header className={cn('flex items-center', SECTION_HEADER_GAP)}>
          <h2
            className={cn(
              SECTION_TITLE,
              twistsEnabled ? 'text-[#F0EDE8]' : 'text-[#888880]',
            )}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Twists
          </h2>
          <div className="flex min-w-0 flex-1 justify-end">
            <HeaderStatus
              twistsEnabled={twistsEnabled}
              windowOpen={windowOpen}
              stageLocked={stageLocked}
              userLocked={userLocked}
              stageRemainingMs={stageRemainingMs}
              userRemainingMs={userRemainingMs}
            />
          </div>
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

function HeaderStatus({
  twistsEnabled,
  windowOpen,
  stageLocked,
  stageRemainingMs,
  userRemainingMs,
}: {
  twistsEnabled: boolean
  windowOpen: boolean
  stageLocked: boolean
  userLocked: boolean
  stageRemainingMs: number
  userRemainingMs: number
}) {
  if (!twistsEnabled) {
    return (
      <span className={cn('max-w-full truncate text-[#444440]', MONO_LABEL)}>
        Inactive
      </span>
    )
  }

  if (windowOpen) {
    return (
      <span
        className={cn(
          MONO_LABEL,
          'shrink-0 animate-pulse rounded-sm bg-[#F0EDE8] px-2 py-1 font-semibold tracking-[0.15em] text-[#080808] shadow-[0_0_14px_rgba(240,237,232,0.45)] max-md:px-1.5 max-md:py-0.5',
        )}
      >
        Submit Now
      </span>
    )
  }

  const ms = stageLocked ? stageRemainingMs : userRemainingMs
  const label = stageLocked ? 'Closes' : 'Cooldown'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  return (
    <span className={cn('max-w-full truncate text-[#888880]', MONO_LABEL)}>
      {label}{' '}
      <span className="text-[#F0EDE8]">
        {mm}
        <span className="text-[#C41E3A]">:</span>
        {ss}
      </span>
    </span>
  )
}

function SubmissionStatus({ state }: { state: SubmissionState }) {
  if (state.kind === 'won') {
    return (
      <p className="text-xs text-[#F0EDE8] max-md:text-[11px]">
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
    return <p className="text-xs text-[#888880] max-md:text-[11px]">{state.reason}</p>
  }
  if (state.kind === 'error') {
    return <p className="text-xs text-[#E8405A] max-md:text-[11px]">{state.message}</p>
  }
  return null
}
