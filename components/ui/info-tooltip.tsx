'use client'

interface InfoTooltipProps {
  label: string
}

export function InfoTooltip({ label }: InfoTooltipProps) {
  return (
    <span className="group/info relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#3A3A3A] text-[10px] font-semibold leading-none text-[#888880] transition-colors hover:border-[#C41E3A]/40 hover:text-[#F0EDE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41E3A]/40"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded border border-[#3A3A3A] bg-[#161616] px-2.5 py-1.5 text-left text-xs leading-snug text-[#888880] opacity-0 shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-opacity duration-150 group-hover/info:opacity-100 group-focus-within/info:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}
