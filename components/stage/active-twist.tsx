'use client'

export interface ActiveTwist {
  text: string
  userDisplayName: string
}

interface Props {
  twist: ActiveTwist | null
}

export function ActiveTwistPanel({ twist }: Props) {
  return (
    <section className="glass-hud pointer-events-auto flex w-full flex-col gap-2 rounded-sm border-l-2 border-l-[#C41E3A]/70 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
      <h3
        className="text-[18px] font-light italic leading-none tracking-[-0.02em] text-[#888880]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Active Twist
      </h3>
      {twist ? (
        <>
          <p
            className="text-[17px] italic leading-snug text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            “{twist.text}”
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#888880]">
            — {twist.userDisplayName}
          </p>
        </>
      ) : (
        <p className="font-mono text-[12px] leading-relaxed text-[#444440]">
          No narrative twist on stage yet.
        </p>
      )}
    </section>
  )
}
