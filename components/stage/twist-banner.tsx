'use client'

import { useEffect, useState } from 'react'

export interface TwistAnnouncement {
  id: string
  text: string
  userDisplayName: string
  receivedAt: number
}

interface Props {
  twist: TwistAnnouncement | null
  /** Auto-dismiss after this many ms. */
  durationMs?: number
}

export function TwistBanner({ twist, durationMs = 7000 }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!twist) {
      setVisible(false)
      return
    }
    setVisible(true)
    const id = setTimeout(() => setVisible(false), durationMs)
    return () => clearTimeout(id)
  }, [twist, durationMs])

  if (!twist || !visible) return null

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 -translate-y-1/2">
      <div className="glass-hud flex max-w-xl flex-col gap-3 rounded-sm border-l-2 border-l-[#C41E3A] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#C41E3A]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C41E3A] shadow-[0_0_10px_#C41E3A]" />
          Twist Injected
        </div>
        <p
          className="text-2xl italic leading-snug text-[#F0EDE8]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          “{twist.text}”
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#888880]">
          — {twist.userDisplayName}
        </p>
      </div>
    </div>
  )
}
