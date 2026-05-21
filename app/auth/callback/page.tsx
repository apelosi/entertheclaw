'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

const OAUTH_POPUP_MESSAGE_TYPE = 'neon-auth:oauth-complete'

function AuthCallbackInner() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const isPopup = searchParams.get('neon_popup') === '1'
    const verifier = searchParams.get('neon_auth_session_verifier')
    const callback = searchParams.get('neon_popup_callback') ?? '/dashboard'

    if (isPopup && window.opener) {
      window.opener.postMessage(
        { type: OAUTH_POPUP_MESSAGE_TYPE, verifier: verifier ?? null },
        window.location.origin
      )
      window.close()
      return
    }

    const target = new URL(callback, window.location.origin)
    if (verifier) {
      target.searchParams.set('neon_auth_session_verifier', verifier)
    }
    window.location.replace(target.toString())
  }, [searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080808]">
      <p className="text-sm text-[#888880]">Completing sign-in…</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#080808]">
          <p className="text-sm text-[#888880]">Completing sign-in…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  )
}
