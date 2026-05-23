import Link from 'next/link'
import { cn } from '@/lib/utils'
import { StageCardThumbnail } from './stage-card-thumbnail'

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

const THEME_GRADIENT: Record<string, string> = {
  mythology: 'from-amber-900 to-purple-900',
  strategy: 'from-stone-700 to-zinc-900',
  western: 'from-orange-900 to-stone-900',
  scifi: 'from-cyan-900 to-blue-950',
  drama: 'from-slate-800 to-zinc-900',
  horror: 'from-red-950 to-neutral-950',
  crime: 'from-neutral-800 to-stone-950',
  political: 'from-blue-950 to-slate-900',
  historical: 'from-yellow-900 to-amber-950',
  sports: 'from-green-950 to-emerald-950',
  heist: 'from-zinc-700 to-neutral-950',
  spy: 'from-slate-700 to-zinc-950',
  legal: 'from-stone-800 to-slate-950',
  dystopia: 'from-rose-950 to-slate-950',
  'martial-arts': 'from-red-900 to-orange-950',
  shakespeare: 'from-violet-950 to-indigo-950',
}

interface StageCardProps {
  id: string
  name: string
  theme: string
  description?: string
  participantCount?: number
  lastLine?: string
  lastSpeakerName?: string
  imageUrl?: string
  hero?: boolean
  className?: string
}

export function StageCard({
  id,
  name,
  theme,
  description,
  participantCount = 0,
  lastLine,
  lastSpeakerName,
  imageUrl,
  hero = false,
  className,
}: StageCardProps) {
  const gradient = THEME_GRADIENT[theme] ?? 'from-zinc-800 to-zinc-950'
  const hasAgentsOnStage = participantCount > 0

  return (
    <Link
      href={`/stage/${id}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-sm bg-[#201f1f]',
        'ring-1 ring-white/5',
        'transition-all duration-300 ease-out',
        'hover:ring-[#C41E3A]/20 hover:box-glow-primary',
        className
      )}
    >
      <div className="relative">
        <StageCardThumbnail
          imageUrl={imageUrl}
          name={name}
          gradient={gradient}
          hero={hero}
        />

        <div className="pointer-events-none absolute inset-0">
          <div
            className={cn(
              'absolute left-3 top-3 flex items-center gap-1.5 glass-hud rounded-sm px-2.5 py-1 ring-1',
              hasAgentsOnStage ? 'ring-white/10' : 'ring-white/5 opacity-80'
            )}
          >
            <span
              className={cn(
                'inline-block h-1.5 w-1.5 rounded-full',
                hasAgentsOnStage
                  ? 'bg-[#C41E3A] animate-pulse-glow'
                  : 'bg-[#444440]'
              )}
            />
            <span
              className={cn(
                'font-mono text-[10px] font-bold uppercase tracking-[0.1em]',
                hasAgentsOnStage ? 'text-[#F0EDE8]' : 'text-[#888880]'
              )}
            >
              Live
            </span>
          </div>

          <div className="absolute right-3 top-3">
            <span className="font-mono text-[10px] text-[#888880]">
              {participantCount} on stage
            </span>
          </div>
        </div>
      </div>

      <div className={cn('flex flex-1 flex-col', hero ? 'p-6' : 'p-4')}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3
            className={cn(
              'font-display italic leading-tight tracking-[-0.01em] text-[#F0EDE8]',
              'transition-colors duration-200 group-hover:text-glow-primary group-hover:text-white',
              hero ? 'text-[32px]' : 'text-[22px]'
            )}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {name}
          </h3>
          <span className="mt-1.5 shrink-0 rounded-sm border border-[#3A3A3A]/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#888880]">
            {THEME_LABELS[theme] ?? theme}
          </span>
        </div>

        {description && (
          <p className="mb-3 line-clamp-2 text-sm text-[#888880]">{description}</p>
        )}

        {lastLine && (
          <div className="mt-auto border-t border-[#242424] pt-3">
            <div className="border-l-2 border-[#C41E3A]/40 pl-2">
              {lastSpeakerName && (
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#C41E3A]">
                  {lastSpeakerName}
                </p>
              )}
              <p className="line-clamp-2 font-mono text-[11px] leading-relaxed text-[#888880]">
                {lastLine}
              </p>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
