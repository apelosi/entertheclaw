type OtpApiResponse = {
  success?: boolean
  error?: string
  message?: string
  code?: string
}

function otpSendError(data: OtpApiResponse, status: number): string {
  const message = data.message ?? data.error
  if (message) return message
  if (status === 429) {
    return 'Too many sign-in code requests. Wait a minute, then use Resend code or try again.'
  }
  return 'Could not send sign-in code.'
}

export async function sendSignInOtp(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('/api/auth/email-otp/send-verification-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, type: 'sign-in' }),
  })

  const data = (await res.json().catch(() => ({}))) as OtpApiResponse

  if (!res.ok || data.success !== true) {
    return {
      ok: false,
      error: otpSendError(data, res.status),
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
