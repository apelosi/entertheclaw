/**
 * Start OAuth via full-page redirect (bypasses Neon iframe popup flow).
 */
export async function startSocialSignIn(options: {
  provider: 'github' | 'google' | 'apple'
  callbackURL: string
  newUserCallbackURL?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('/api/auth/sign-in/social', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      provider: options.provider,
      callbackURL: options.callbackURL,
      disableRedirect: true,
      ...(options.newUserCallbackURL
        ? { newUserCallbackURL: options.newUserCallbackURL }
        : {}),
    }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    url?: string
    error?: string
    message?: string
  }

  if (!res.ok || typeof data.url !== 'string') {
    return {
      ok: false,
      error: data.error ?? data.message ?? 'Could not start OAuth sign-in',
    }
  }

  window.location.assign(data.url)
  return { ok: true }
}
