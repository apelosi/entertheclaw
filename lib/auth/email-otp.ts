/** Neon Auth / Better Auth default for email-otp send endpoints. */
export const OTP_SERVER_MAX_PER_WINDOW = 3
export const OTP_SERVER_WINDOW_SEC = 60
/** Client-side minimum gap between sends (reduces accidental bursts before server 429). */
export const OTP_CLIENT_MIN_INTERVAL_SEC = 20

const STORAGE_KEY_PREFIX = 'etc-otp-send:'
const RATE_LIMIT_BACKOFF_MS = OTP_SERVER_WINDOW_SEC * 1000

type OtpApiResponse = {
  success?: boolean
  error?: string
  message?: string
  code?: string
}

type OtpSendState = {
  recentSends?: number[]
  blockedUntil?: number
}

export type SendSignInOtpResult =
  | { ok: true }
  | {
      ok: false
      error: string
      rateLimited?: boolean
      retryAfterSec?: number
      clientBlocked?: boolean
    }

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function storageKey(email: string): string {
  return `${STORAGE_KEY_PREFIX}${normalizeEmail(email)}`
}

function readState(email: string): OtpSendState {
  if (typeof sessionStorage === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(storageKey(email))
    if (!raw) return {}
    return JSON.parse(raw) as OtpSendState
  } catch {
    return {}
  }
}

function writeState(email: string, state: OtpSendState): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(storageKey(email), JSON.stringify(state))
  } catch {
    // sessionStorage full or disabled
  }
}

function pruneRecentSends(sends: number[], now: number): number[] {
  return sends.filter((t) => now - t < RATE_LIMIT_BACKOFF_MS)
}

export function getOtpSendCooldown(email: string): {
  blocked: boolean
  retryAfterSec: number
  clientBlocked: boolean
} {
  const now = Date.now()
  const state = readState(email)
  const recent = pruneRecentSends(state.recentSends ?? [], now)

  if (state.blockedUntil && now < state.blockedUntil) {
    return {
      blocked: true,
      retryAfterSec: Math.max(1, Math.ceil((state.blockedUntil - now) / 1000)),
      clientBlocked: false,
    }
  }

  if (recent.length >= OTP_SERVER_MAX_PER_WINDOW) {
    const oldest = recent[0]!
    return {
      blocked: true,
      retryAfterSec: Math.max(1, Math.ceil((RATE_LIMIT_BACKOFF_MS - (now - oldest)) / 1000)),
      clientBlocked: true,
    }
  }

  const lastSent = recent[recent.length - 1]
  if (lastSent) {
    const minGapMs = OTP_CLIENT_MIN_INTERVAL_SEC * 1000
    const elapsed = now - lastSent
    if (elapsed < minGapMs) {
      return {
        blocked: true,
        retryAfterSec: Math.max(1, Math.ceil((minGapMs - elapsed) / 1000)),
        clientBlocked: true,
      }
    }
  }

  return { blocked: false, retryAfterSec: 0, clientBlocked: false }
}

function recordSendSuccess(email: string): void {
  const now = Date.now()
  const state = readState(email)
  const recent = [...pruneRecentSends(state.recentSends ?? [], now), now]
  writeState(email, { recentSends: recent, blockedUntil: undefined })
}

function recordServerRateLimit(email: string): void {
  const now = Date.now()
  const state = readState(email)
  writeState(email, {
    ...state,
    blockedUntil: now + RATE_LIMIT_BACKOFF_MS,
  })
}

function formatBlockedMessage(retryAfterSec: number, clientBlocked: boolean): string {
  if (clientBlocked) {
    return `You can request up to ${OTP_SERVER_MAX_PER_WINDOW} codes per minute. Wait ${retryAfterSec}s before trying again. If you already have a code, use the newest one in your inbox.`
  }
  return `Too many sign-in code requests (Neon Auth limit: ${OTP_SERVER_MAX_PER_WINDOW} per minute). Wait ${retryAfterSec}s. If a code was already sent, check spam and use the newest one.`
}

function otpSendError(data: OtpApiResponse, status: number, retryAfterSec?: number): string {
  const message = data.message ?? data.error
  if (message && status !== 429) return message
  if (status === 429) {
    const wait = retryAfterSec ?? OTP_SERVER_WINDOW_SEC
    return formatBlockedMessage(wait, false)
  }
  return 'Could not send sign-in code.'
}

function verificationCodeSendError(
  data: OtpApiResponse,
  status: number,
  retryAfterSec?: number,
): string {
  const message = data.message ?? data.error
  if (message && status !== 429) return message
  if (status === 429) {
    const wait = retryAfterSec ?? OTP_SERVER_WINDOW_SEC
    return formatBlockedMessage(wait, false)
  }
  return 'Could not send verification code.'
}

let sendInFlight: Promise<SendSignInOtpResult> | null = null
let sendInFlightEmail: string | null = null

export async function sendSignInOtp(email: string): Promise<SendSignInOtpResult> {
  const normalized = normalizeEmail(email)
  if (!normalized || !normalized.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  const cooldown = getOtpSendCooldown(normalized)
  if (cooldown.blocked) {
    return {
      ok: false,
      error: formatBlockedMessage(cooldown.retryAfterSec, cooldown.clientBlocked),
      rateLimited: true,
      retryAfterSec: cooldown.retryAfterSec,
      clientBlocked: cooldown.clientBlocked,
    }
  }

  if (sendInFlight && sendInFlightEmail === normalized) {
    return sendInFlight
  }

  const request = (async (): Promise<SendSignInOtpResult> => {
    const res = await fetch('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: normalized, type: 'sign-in' }),
    })

    const data = (await res.json().catch(() => ({}))) as OtpApiResponse

    if (res.status === 429) {
      recordServerRateLimit(normalized)
      const retryAfterSec = OTP_SERVER_WINDOW_SEC
      return {
        ok: false,
        error: otpSendError(data, res.status, retryAfterSec),
        rateLimited: true,
        retryAfterSec,
      }
    }

    if (!res.ok || data.success !== true) {
      return {
        ok: false,
        error: otpSendError(data, res.status),
      }
    }

    recordSendSuccess(normalized)
    return { ok: true }
  })()

  sendInFlight = request
  sendInFlightEmail = normalized

  try {
    return await request
  } finally {
    if (sendInFlight === request) {
      sendInFlight = null
      sendInFlightEmail = null
    }
  }
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
      email: options.email.trim(),
      otp: options.otp.trim(),
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

export type SendForgetPasswordOtpResult = SendSignInOtpResult

/** Sends a forget-password OTP (used to set an initial password on the account page). */
export async function sendForgetPasswordOtp(email: string): Promise<SendForgetPasswordOtpResult> {
  const normalized = normalizeEmail(email)
  if (!normalized || !normalized.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  const cooldown = getOtpSendCooldown(normalized)
  if (cooldown.blocked) {
    return {
      ok: false,
      error: formatBlockedMessage(cooldown.retryAfterSec, cooldown.clientBlocked),
      rateLimited: true,
      retryAfterSec: cooldown.retryAfterSec,
      clientBlocked: cooldown.clientBlocked,
    }
  }

  // Omit session cookies: Better Auth validates Origin when cookies are present.
  // Production Neon Auth may only list localhost until trusted domains are configured.
  const res = await fetch('/api/auth/forget-password/email-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify({ email: normalized }),
  })

  const data = (await res.json().catch(() => ({}))) as OtpApiResponse

  if (res.status === 429) {
    recordServerRateLimit(normalized)
    const retryAfterSec = OTP_SERVER_WINDOW_SEC
    return {
      ok: false,
      error: verificationCodeSendError(data, res.status, retryAfterSec),
      rateLimited: true,
      retryAfterSec,
    }
  }

  if (!res.ok || data.success !== true) {
    return {
      ok: false,
      error: verificationCodeSendError(data, res.status),
    }
  }

  recordSendSuccess(normalized)
  return { ok: true }
}

export type ResetPasswordWithEmailOtpResult =
  | { ok: true }
  | { ok: false; error: string }

/** Sets or resets password using a forget-password OTP (account page set-password flow). */
export async function resetPasswordWithEmailOtp(options: {
  email: string
  otp: string
  password: string
}): Promise<ResetPasswordWithEmailOtpResult> {
  const email = normalizeEmail(options.email)
  const otp = options.otp.trim()
  const password = options.password

  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' }
  }
  if (!otp) {
    return { ok: false, error: 'Verification code is required.' }
  }

  const res = await fetch('/api/auth/email-otp/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify({ email, otp, password }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    message?: string
    code?: string
  }

  if (!res.ok) {
    return {
      ok: false,
      error: data.message ?? data.error ?? 'Could not set password.',
    }
  }

  return { ok: true }
}
