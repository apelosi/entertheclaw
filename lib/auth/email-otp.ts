export async function sendSignInOtp(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('/api/auth/email-otp/send-verification-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, type: 'sign-in' }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean
    error?: string
    message?: string
  }

  if (!res.ok || data.success === false) {
    return {
      ok: false,
      error: data.message ?? data.error ?? 'Could not send sign-in code.',
    }
  }

  return { ok: true }
}

export async function verifySignInOtp(options: {
  email: string
  otp: string
  name?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('/api/auth/sign-in/email-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      email: options.email,
      otp: options.otp,
      ...(options.name ? { name: options.name } : {}),
    }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    message?: string
    code?: string
  }

  if (!res.ok) {
    return {
      ok: false,
      error: data.message ?? data.error ?? 'Invalid or expired code.',
    }
  }

  return { ok: true }
}
