'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <rect
        x="5.5"
        y="5.5"
        width="8"
        height="8"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M3.5 10.5V3.5C3.5 2.94772 3.94772 2.5 4.5 2.5H10.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
}

export function CopyButton({ text, label = 'Copy', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied!' : label}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#3A3A3A] text-[#888880] transition-colors hover:border-[#444440] hover:bg-[#161616] hover:text-[#F0EDE8]',
        copied && 'border-[#C41E3A]/40 text-[#C41E3A]',
        className
      )}
    >
      <CopyIcon />
    </button>
  )
}
