'use client'

import { authClient } from '@/lib/auth-client'

/**
 * Start OAuth link flow for an already-signed-in user (attaches provider to current account).
 */
export async function startSocialLink(options: {
  provider: 'github' | 'google'
  callbackURL: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await authClient.linkSocial({
    provider: options.provider,
    callbackURL: options.callbackURL,
    disableRedirect: true,
  })

  if (result.error) {
    return {
      ok: false,
      error: result.error.message ?? 'Could not start OAuth link',
    }
  }

  const url = result.data?.url
  if (typeof url !== 'string') {
    return { ok: false, error: 'Could not start OAuth link' }
  }

  window.location.assign(url)
  return { ok: true }
}
