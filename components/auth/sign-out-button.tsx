'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export function SignOutButton() {
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
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className="inline-flex h-9 items-center justify-center rounded border border-[#3A3A3A] px-3 text-sm font-medium text-[#888880] transition-colors hover:border-[#C41E3A]/30 hover:bg-[#161616] hover:text-[#F0EDE8] disabled:opacity-50"
    >
      {signingOut ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
