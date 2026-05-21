'use client'

import Link from 'next/link'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

interface AccountMenuProps {
  userDisplayName: string
}

export function AccountMenu({ userDisplayName }: AccountMenuProps) {
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await authClient.signOut()
      window.location.assign('/')
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/account"
        title="Account"
        className="flex h-8 items-center gap-2 rounded border border-[#3A3A3A] px-3 font-ui text-[13px] font-medium text-[#F0EDE8] transition-colors hover:bg-[#161616] hover:border-[#C41E3A]/30"
      >
        <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-[#C41E3A] text-center font-mono text-[10px] leading-5 text-white">
          {userDisplayName[0]?.toUpperCase() ?? '?'}
        </span>
        <span className="hidden sm:inline">{userDisplayName}</span>
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="inline-flex h-8 items-center justify-center rounded border border-[#3A3A3A] px-3 font-ui text-[13px] font-medium text-[#888880] transition-colors hover:border-[#C41E3A]/30 hover:bg-[#161616] hover:text-[#F0EDE8] disabled:opacity-50"
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  )
}
