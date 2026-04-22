'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import type { Metadata } from 'next'

// Social button component
function SocialButton({
  provider,
  label,
  icon,
}: {
  provider: 'github' | 'google' | 'apple'
  label: string
  icon: React.ReactNode
}) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    await authClient.signIn.social({
      provider,
      callbackURL: '/dashboard',
    })
    // redirect happens automatically
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex h-10 w-full items-center justify-center gap-2.5 rounded border border-[#3A3A3A] bg-[#161616] text-sm font-medium text-[#F0EDE8] transition-colors hover:border-[#C41E3A] hover:bg-[#1E1E1E] disabled:opacity-50"
    >
      {icon}
      {loading ? 'Redirecting…' : label}
    </button>
  )
}

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        const res = await authClient.signUp.email({
          email,
          password,
          name: email.split('@')[0],
          callbackURL: '/dashboard',
        })
        if (res.error) {
          setError(res.error.message ?? 'Sign up failed.')
        } else {
          router.push('/dashboard')
        }
      } else {
        const res = await authClient.signIn.email({
          email,
          password,
          callbackURL: '/dashboard',
        })
        if (res.error) {
          setError(res.error.message ?? 'Sign in failed.')
        } else {
          router.push('/dashboard')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080808] px-4">
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="mb-8 text-center">
          <Link href="/">
            <h1
              className="font-display text-[32px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Enter The Claw
            </h1>
          </Link>
          <p className="mt-2 text-sm text-[#888880]">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {/* Social buttons — GitHub first per design */}
        <div className="space-y-3">
          <SocialButton
            provider="github"
            label="Continue with GitHub"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            }
          />
          <SocialButton
            provider="google"
            label="Continue with Google"
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

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#242424]" />
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#444440]">
            or
          </span>
          <div className="h-px flex-1 bg-[#242424]" />
        </div>

        {/* Email + password form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-10 w-full rounded border border-[#3A3A3A] bg-[#161616] px-3 text-sm text-[#F0EDE8] placeholder-[#444440] outline-none transition-colors focus:border-[#C41E3A]"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-10 w-full rounded border border-[#3A3A3A] bg-[#161616] px-3 text-sm text-[#F0EDE8] placeholder-[#444440] outline-none transition-colors focus:border-[#C41E3A]"
          />

          {error && <p className="text-xs text-[#C41E3A]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded bg-[#C41E3A] text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30] disabled:opacity-50"
          >
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {/* Toggle sign-in / sign-up */}
        <p className="mt-6 text-center text-xs text-[#888880]">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setError(''); setIsSignUp(!isSignUp) }}
            className="text-[#F0EDE8] underline-offset-2 hover:underline"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  )
}
