'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Props {
  sceneName: string | null
  castCount: number
  inviteHref: string
  onOpenScene: () => void
  onOpenCast: () => void
  onOpenTwist: () => void
  twistsEnabled: boolean
}

/**
 * Mobile-only sticky bar under the stage band. Keeps the primary actions
 * (twist, invite) and the current scene/cast always reachable in one tap.
 * The chips open bottom sheets; Invite goes straight to the invite page.
 * Hidden on lg+, where the rail shows these as always-expanded cards.
 */
export function StageActionBar({
  sceneName,
  castCount,
  inviteHref,
  onOpenScene,
  onOpenCast,
  onOpenTwist,
  twistsEnabled,
}: Props) {
  const router = useRouter()
  const chip =
    'inline-flex min-w-0 items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors'

  return (
    <div className="sticky top-14 z-20 flex flex-col gap-1.5 border-b border-[#242424]/50 bg-[#080808]/90 px-3 py-2 backdrop-blur-sm lg:hidden">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenScene}
          className={cn(chip, 'min-w-0 flex-1 border-[#2A8E8E]/50 text-[#2A8E8E]')}
        >
          <span className="truncate">{sceneName ?? 'Scene'}</span>
          <span aria-hidden>▾</span>
        </button>
        <button
          type="button"
          onClick={onOpenCast}
          className={cn(chip, 'shrink-0 border-[#3A3A3A] text-[#bdbdbd]')}
        >
          Cast {String(castCount).padStart(2, '0')}
          <span aria-hidden>▾</span>
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenTwist}
          className={cn(
            'inline-flex flex-1 items-center justify-center rounded-sm px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.15em] transition-all',
            twistsEnabled
              ? 'bg-[#C41E3A] text-[#F0EDE8] hover:bg-[#9B1B30]'
              : 'bg-[#161616] text-[#666]',
          )}
        >
          Twist
        </button>
        {/* A <button> (not a Link) with a hard navigation: an <a>/Link tap can
            be swallowed inside this sticky + backdrop-blur bar on mobile Safari,
            while the sibling Twist <button> works — so match it. */}
        <button
          type="button"
          onClick={() => {
            router.push(inviteHref)
          }}
          className="inline-flex flex-1 items-center justify-center rounded-sm border border-[#C41E3A]/70 px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#C41E3A] transition-colors hover:bg-[#C41E3A]/10"
        >
          + Invite
        </button>
      </div>
    </div>
  )
}
