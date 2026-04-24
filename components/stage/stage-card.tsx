import Link from 'next/link'
import { cn } from '@/lib/utils'

const THEME_LABELS: Record<string, string> = {
  mythology: 'Mythology',
  strategy: 'Strategy',
  western: 'Western',
  scifi: 'Sci-Fi',
  drama: 'Drama',
  horror: 'Horror',
  crime: 'Crime',
  political: 'Political',
  historical: 'Historical',
  sports: 'Sports',
  heist: 'Heist',
  spy: 'Spy',
  legal: 'Legal',
  dystopia: 'Dystopia',
  'martial-arts': 'Martial Arts',
  shakespeare: 'Shakespeare',
}

interface StageCardProps {
  id: string
  name: string
  theme: string
  description?: string
  participantCount?: number
  lastLine?: string
  className?: string
}

export function StageCard({
  id,
  name,
  theme,
  description,
  participantCount = 0,
  lastLine,
  className,
}: StageCardProps) {
  return (
    <Link
      href={`/stage/${id}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-md border border-[#242424] bg-[#161616]',
        'transition-all duration-150 ease-out',
        'hover:border-[#3A3A3A] hover:shadow-[0_0_20px_rgba(196,30,58,0.08)]',
        className
      )}
    >
      {/* Stage thumbnail area */}
      <div className="relative aspect-video w-full bg-[#111111]">
        {/* Theme gradient placeholder — replace with actual thumbnail when available */}
        <div
          className={cn(
            'absolute inset-0 opacity-20',
            theme === 'mythology' && 'bg-gradient-to-br from-amber-900 to-purple-900',
            theme === 'strategy' && 'bg-gradient-to-br from-stone-700 to-zinc-900',
            theme === 'western' && 'bg-gradient-to-br from-orange-900 to-stone-900',
            theme === 'scifi' && 'bg-gradient-to-br from-cyan-900 to-blue-950',
            theme === 'drama' && 'bg-gradient-to-br from-slate-800 to-zinc-900',
            theme === 'horror' && 'bg-gradient-to-br from-red-950 to-neutral-950',
            theme === 'crime' && 'bg-gradient-to-br from-neutral-800 to-stone-950',
            theme === 'political' && 'bg-gradient-to-br from-blue-950 to-slate-900',
            theme === 'historical' && 'bg-gradient-to-br from-yellow-900 to-amber-950',
            theme === 'sports' && 'bg-gradient-to-br from-green-950 to-emerald-950',
            theme === 'heist' && 'bg-gradient-to-br from-zinc-700 to-neutral-950',
            theme === 'spy' && 'bg-gradient-to-br from-slate-700 to-zinc-950',
            theme === 'legal' && 'bg-gradient-to-br from-stone-800 to-slate-950',
            theme === 'dystopia' && 'bg-gradient-to-br from-rose-950 to-slate-950',
            theme === 'martial-arts' && 'bg-gradient-to-br from-red-900 to-orange-950',
            theme === 'shakespeare' && 'bg-gradient-to-br from-violet-950 to-indigo-950'
          )}
        />

        {/* LIVE badge */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C41E3A] animate-pulse-live" />
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#C41E3A]">
            Live
          </span>
        </div>

        {/* Participant count */}
        <div className="absolute right-3 top-3">
          <span className="font-mono text-[11px] text-[#888880]">
            {participantCount} on stage
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3
            className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[#F0EDE8] group-hover:text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {name}
          </h3>
          <span className="mt-1 shrink-0 rounded border border-[#242424] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#888880]">
            {THEME_LABELS[theme] ?? theme}
          </span>
        </div>

        {description && (
          <p className="mb-3 line-clamp-2 text-sm text-[#888880]">{description}</p>
        )}

        {/* Now Speaking strip */}
        {lastLine && (
          <div className="mt-auto border-t border-[#242424] pt-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#444440]">
              Now Speaking
            </p>
            <p className="line-clamp-2 font-mono text-[11px] leading-relaxed text-[#888880]">
              {lastLine}
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}
