import Link from 'next/link'
import Image from 'next/image'
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

// Fallback gradient per theme when no image has been generated yet
const THEME_GRADIENT: Record<string, string> = {
  mythology:    'from-amber-900 to-purple-900',
  strategy:     'from-stone-700 to-zinc-900',
  western:      'from-orange-900 to-stone-900',
  scifi:        'from-cyan-900 to-blue-950',
  drama:        'from-slate-800 to-zinc-900',
  horror:       'from-red-950 to-neutral-950',
  crime:        'from-neutral-800 to-stone-950',
  political:    'from-blue-950 to-slate-900',
  historical:   'from-yellow-900 to-amber-950',
  sports:       'from-green-950 to-emerald-950',
  heist:        'from-zinc-700 to-neutral-950',
  spy:          'from-slate-700 to-zinc-950',
  legal:        'from-stone-800 to-slate-950',
  dystopia:     'from-rose-950 to-slate-950',
  'martial-arts': 'from-red-900 to-orange-950',
  shakespeare:  'from-violet-950 to-indigo-950',
}

interface StageCardProps {
  id: string
  name: string
  theme: string
  description?: string
  participantCount?: number
  lastLine?: string
  imageUrl?: string
  /** When true the card renders in a larger "hero" style */
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
  imageUrl,
  hero = false,
  className,
}: StageCardProps) {
  const gradient = THEME_GRADIENT[theme] ?? 'from-zinc-800 to-zinc-950'

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
      {/* Thumbnail */}
      <div className={cn('relative w-full overflow-hidden bg-[#0e0e0e]', hero ? 'aspect-[16/9]' : 'aspect-video')}>
        {imageUrl ? (
          <>
            <Image
              src={imageUrl}
              alt={`${name} stage`}
              fill
              className="object-cover opacity-80 image-pixelated transition-all duration-700 group-hover:scale-[1.03] group-hover:opacity-100"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
            {/* Gradient overlay so text is legible */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#201f1f] via-[#201f1f]/40 to-transparent" />
          </>
        ) : (
          /* Fallback gradient placeholder */
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-br opacity-25',
              gradient
            )}
          />
        )}

        {/* LIVE badge — glassmorphism */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 glass-hud rounded-sm px-2.5 py-1 ring-1 ring-white/10">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C41E3A] animate-pulse-glow" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#F0EDE8]">
            Live
          </span>
        </div>

        {/* Participant count */}
        <div className="absolute right-3 top-3">
          <span className="font-mono text-[10px] text-[#888880]">
            {participantCount} on stage
          </span>
        </div>
      </div>

      {/* Body */}
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

        {/* Now Speaking strip */}
        {lastLine && (
          <div className="mt-auto border-t border-[#242424] pt-3">
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#444440]">
              Now Speaking
            </p>
            <div className="border-l-2 border-[#C41E3A]/40 pl-2">
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
