'use client'

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { startSocialSignIn } from '@/lib/auth/start-social-sign-in'
import { sendSignInOtp, verifySignInOtp } from '@/lib/auth/email-otp'
import {
  isExistingUserSignUpError,
  isNewUserSignInError,
} from '@/lib/auth/email-auth-errors'

import { displayNameOnboardingPath, needsDisplayName } from '@/lib/auth/display-name'
import { HOME_PATH } from '@/lib/paths'

type Step = 'main' | 'otp' | 'password'

const OTP_EMAIL_HINT =
  'Check spam and Promotions. Subject: “Your Sign-In Code - Enter the Claw (dev)” from entertheclaw@vibez.ventures.'
const OTP_RESEND_COOLDOWN_SEC = 60

function SocialButton({
  provider,
  label,
  icon,
  callbackURL,
  newUserCallbackURL,
}: {
  provider: 'github' | 'google' | 'apple'
  label: string
  icon: ReactNode
  callbackURL: string
  newUserCallbackURL?: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClick = async () => {
    setLoading(true)
    setError('')
    const result = await startSocialSignIn({ provider, callbackURL, newUserCallbackURL })
    if (!result.ok) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex h-10 w-full items-center justify-center gap-2.5 rounded border border-[#3A3A3A] bg-[#161616] text-sm font-medium text-[#F0EDE8] transition-colors hover:border-[#C41E3A] hover:bg-[#1E1E1E] disabled:opacity-50"
      >
        {icon}
        {loading ? 'Redirecting…' : label}
      </button>
      {error ? <p className="text-xs text-[#C41E3A]">{error}</p> : null}
    </div>
  )
}

function AuthFormInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackURL = searchParams.get('callbackUrl') ?? HOME_PATH
  const newUserCallbackURL = displayNameOnboardingPath(callbackURL)

  const [step, setStep] = useState<Step>('main')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const resetMessages = () => {
    setError('')
    setInfo('')
  }

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = window.setTimeout(() => {
      setResendCooldown((seconds) => (seconds <= 1 ? 0 : seconds - 1))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [resendCooldown])

  const finishAuth = async () => {
    const session = await authClient.getSession()
    const user = session.data?.user
    if (user && needsDisplayName(user)) {
      router.push(displayNameOnboardingPath(callbackURL))
      return
    }
    router.push(callbackURL)
  }

  const requestSignInOtp = async (options?: { advanceToOtp?: boolean }) => {
    resetMessages()
    setLoading(true)
    try {
      const result = await sendSignInOtp(email.trim())
      if (!result.ok) {
        setError(result.error)
        return false
      }
      setInfo('We sent a sign-in code to your email.')
      setResendCooldown(OTP_RESEND_COOLDOWN_SEC)
      if (options?.advanceToOtp !== false) setStep('otp')
      return true
    } catch {
      setError('Could not send sign-in code. Check your connection and try again.')
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleEmailContinue = async () => {
    await requestSignInOtp()
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return
    await requestSignInOtp({ advanceToOtp: false })
  }

  const handleOtpSubmit = async () => {
    resetMessages()
    setLoading(true)
    try {
      const result = await verifySignInOtp({
        email: email.trim(),
        otp: otp.trim(),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      await finishAuth()
    } catch {
      setError('Could not verify code. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async () => {
    resetMessages()
    setLoading(true)

    try {
      const signInRes = await authClient.signIn.email({
        email: email.trim(),
        password,
        callbackURL,
      })

      if (!signInRes.error) {
        await finishAuth()
        return
      }

      const signInCode = (signInRes.error as { code?: string }).code
      const signInMessage = signInRes.error.message

      if (!isNewUserSignInError(signInMessage, signInCode)) {
        setError(signInMessage ?? 'Could not sign in.')
        return
      }

      const signUpRes = await authClient.signUp.email({
        email: email.trim(),
        password,
        name: '',
        callbackURL,
      })

      if (!signUpRes.error) {
        await finishAuth()
        return
      }

      const signUpCode = (signUpRes.error as { code?: string }).code
      const signUpMessage = signUpRes.error.message

      if (isExistingUserSignUpError(signUpMessage, signUpCode)) {
        setError('An account with this email already exists. Check your password and try again.')
        return
      }

      setError(signUpMessage ?? 'Could not create account.')
    } catch {
      setError('Could not sign in. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'h-10 w-full rounded border border-[#3A3A3A] bg-[#161616] px-3 text-sm text-[#F0EDE8] placeholder-[#444440] outline-none transition-colors focus:border-[#C41E3A]'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080808] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/">
            <h1
              className="font-display text-[32px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Enter The Claw
            </h1>
          </Link>
          <p className="mt-2 text-sm text-[#888880]">Sign in or create an account</p>
        </div>

        {step === 'main' && (
          <>
            <div className="space-y-3">
              <SocialButton
                provider="github"
                label="Continue with GitHub"
                callbackURL={callbackURL}
                newUserCallbackURL={newUserCallbackURL}
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                }
              />
              <SocialButton
                provider="google"
                label="Continue with Google"
                callbackURL={callbackURL}
                newUserCallbackURL={newUserCallbackURL}
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                }
              />
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#242424]" />
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#444440]">
                or
              </span>
              <div className="h-px flex-1 bg-[#242424]" />
            </div>

            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleEmailContinue()
                  }
                }}
              />
              {error && <p className="text-xs text-[#C41E3A]">{error}</p>}
              {info && <p className="text-xs text-[#888880]">{info}</p>}
              <button
                type="button"
                disabled={loading || !email.trim()}
                onClick={() => void handleEmailContinue()}
                className="h-10 w-full rounded bg-[#C41E3A] text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30] disabled:opacity-50"
              >
                {loading ? 'Please wait…' : 'Continue with Email'}
              </button>
            </div>

            <p className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  resetMessages()
                  setStep('password')
                }}
                className="text-xs text-[#888880] underline-offset-2 hover:text-[#F0EDE8] hover:underline"
              >
                Use password instead
              </button>
            </p>
          </>
        )}

        {step === 'otp' && (
          <>
            <p className="mb-2 text-center text-sm text-[#888880]">
              Enter the code we sent to <span className="text-[#F0EDE8]">{email}</span>
            </p>
            <p className="mb-4 text-center text-xs text-[#666660]">{OTP_EMAIL_HINT}</p>
            <div className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Sign-in code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                className={inputClass}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleOtpSubmit()
                  }
                }}
              />
              {error && <p className="text-xs text-[#C41E3A]">{error}</p>}
              {info && <p className="text-xs text-[#888880]">{info}</p>}
              <button
                type="button"
                disabled={loading || !otp.trim()}
                onClick={() => void handleOtpSubmit()}
                className="h-10 w-full rounded bg-[#C41E3A] text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30] disabled:opacity-50"
              >
                {loading ? 'Please wait…' : 'Continue'}
              </button>
            </div>
            <p className="mt-4 space-y-2 text-center text-xs text-[#888880]">
              <span className="block">
                <button
                  type="button"
                  disabled={loading || resendCooldown > 0}
                  onClick={() => void handleResendOtp()}
                  className="text-[#F0EDE8] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-[#555550] disabled:no-underline"
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : 'Resend code'}
                </button>
              </span>
              <span className="block">
                <button
                  type="button"
                  onClick={() => {
                    resetMessages()
                    setResendCooldown(0)
                    setStep('main')
                  }}
                  className="text-[#F0EDE8] underline-offset-2 hover:underline"
                >
                  Use a different email
                </button>
              </span>
            </p>
          </>
        )}

        {step === 'password' && (
          <>
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={inputClass}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handlePasswordSubmit()
                  }
                }}
              />
              {error && <p className="text-xs text-[#C41E3A]">{error}</p>}
              <button
                type="button"
                disabled={loading || !email.trim() || !password}
                onClick={() => void handlePasswordSubmit()}
                className="h-10 w-full rounded bg-[#C41E3A] text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30] disabled:opacity-50"
              >
                {loading ? 'Please wait…' : 'Continue'}
              </button>
            </div>
            <p className="mt-4 text-center text-xs text-[#888880]">
              <button
                type="button"
                onClick={() => {
                  resetMessages()
                  setStep('main')
                }}
                className="text-[#F0EDE8] underline-offset-2 hover:underline"
              >
                Continue with Email code instead
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export function AuthForm() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080808]" />}>
      <AuthFormInner />
    </Suspense>
  )
}
