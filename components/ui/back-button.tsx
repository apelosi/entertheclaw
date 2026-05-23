'use client'

import { useRouter } from 'next/navigation'

type BackButtonProps = {
  /** Used when there is no in-app history entry to pop (direct visit / new tab). */
  fallbackHref: string
  className?: string
}

export function BackButton({ fallbackHref, className }: BackButtonProps) {
  const router = useRouter()

  return (
    <button
      type="button"
      aria-label="Go back"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back()
          return
        }
        router.push(fallbackHref)
      }}
      className={
        className ??
        'text-lg leading-none text-[#888880] transition-colors hover:text-[#F0EDE8]'
      }
    >
      ←
    </button>
  )
}
