'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { getOtpSendCooldown, sendForgetPasswordOtp } from '@/lib/auth/email-otp'
import {
  PASSWORD_MIN_LENGTH,
  validateNewPassword,
  validatePasswordConfirm,
} from '@/lib/auth/password'

type LinkedAccount = {
  providerId: string
}

type SetPasswordStep = 'send-code' | 'enter-password'

function hasPasswordCredential(accounts: LinkedAccount[]) {
  return accounts.some(
    (a) => a.providerId === 'credential' || a.providerId === 'email',
  )
}

export function PasswordForm() {
  const router = useRouter()
  const [hasCredential, setHasCredential] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [setStep, setSetStep] = useState<SetPasswordStep>('send-code')
  const [otp, setOtp] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const loadAccounts = useCallback(async () => {
    const result = await authClient.listAccounts()
    if (result.error) {
      setError(result.error.message ?? 'Could not load sign-in methods.')
      setHasCredential(null)
      return
    }
    setHasCredential(hasPasswordCredential((result.data ?? []) as LinkedAccount[]))
    setError('')
  }, [])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    void authClient.getSession().then((result) => {
      const email = result.data?.user?.email?.trim() ?? ''
      setUserEmail(email)
    })
  }, [])

  useEffect(() => {
    if (!userEmail) return
    const { blocked, retryAfterSec } = getOtpSendCooldown(userEmail)
    setResendCooldown(blocked ? retryAfterSec : 0)
  }, [userEmail, setStep])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = window.setTimeout(() => {
      setResendCooldown((seconds) => {
        const next = seconds <= 1 ? 0 : seconds - 1
        if (next === 0 && userEmail) {
          const { blocked, retryAfterSec } = getOtpSendCooldown(userEmail)
          return blocked ? retryAfterSec : 0
        }
        return next
      })
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [resendCooldown, userEmail])

  const inputClass =
    'h-10 w-full rounded border border-[#3A3A3A] bg-[#161616] px-3 text-sm text-[#F0EDE8] placeholder-[#444440] outline-none transition-colors focus:border-[#C41E3A]'

  const resetFields = () => {
    setOtp('')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  async function handleSendSetPasswordCode() {
    setError('')
    setSuccess('')

    if (!userEmail) {
      setError('No email on your account. Add a verified email before setting a password.')
      return
    }

    const cooldown = getOtpSendCooldown(userEmail)
    if (cooldown.blocked) {
      setError(`Wait ${cooldown.retryAfterSec}s before requesting another code.`)
      setResendCooldown(cooldown.retryAfterSec)
      return
    }

    setLoading(true)
    try {
      const result = await sendForgetPasswordOtp(userEmail)
      if (!result.ok) {
        setError(result.error)
        if (result.retryAfterSec) setResendCooldown(result.retryAfterSec)
        return
      }
      setSetStep('enter-password')
      setSuccess('Verification code sent. Check your inbox (and spam).')
      const after = getOtpSendCooldown(userEmail)
      setResendCooldown(after.blocked ? after.retryAfterSec : 0)
    } catch {
      setError('Could not send verification code. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetPasswordWithOtp() {
    setError('')
    setSuccess('')

    if (!userEmail) {
      setError('No email on your account.')
      return
    }
    if (!otp.trim()) {
      setError('Verification code is required.')
      return
    }

    const passwordError = validateNewPassword(newPassword)
    if (passwordError) {
      setError(passwordError)
      return
    }
    const confirmError = validatePasswordConfirm(newPassword, confirmPassword)
    if (confirmError) {
      setError(confirmError)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/account/set-password-with-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          otp: otp.trim(),
          password: newPassword,
          confirmPassword,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
        code?: string
      }
      if (!res.ok) {
        setError(data.message ?? data.error ?? 'Could not set password.')
        return
      }
      setSuccess('Password set. You can now sign in with email and password.')
      resetFields()
      setSetStep('send-code')
      await loadAccounts()
      router.refresh()
    } catch {
      setError('Could not set password. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePassword() {
    setError('')
    setSuccess('')

    if (!currentPassword) {
      setError('Current password is required.')
      return
    }
    const passwordError = validateNewPassword(newPassword)
    if (passwordError) {
      setError(passwordError)
      return
    }
    const confirmError = validatePasswordConfirm(newPassword, confirmPassword)
    if (confirmError) {
      setError(confirmError)
      return
    }

    setLoading(true)
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })
      if (result.error) {
        setError(result.error.message ?? 'Could not change password.')
        return
      }
      setSuccess('Password updated.')
      resetFields()
      router.refresh()
    } catch {
      setError('Could not change password. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const isSetMode = hasCredential === false
  const title = isSetMode ? 'Set password' : 'Change password'
  const description = isSetMode
    ? setStep === 'send-code'
      ? 'Add a password so you can sign in with email and password. We will email you a verification code first.'
      : `Enter the code sent to ${userEmail || 'your email'}, then choose a password.`
    : 'Update your password. Other signed-in devices will be signed out.'

  const canSubmitSet =
    setStep === 'enter-password' &&
    !loading &&
    otp.trim().length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0

  const canSubmitChange =
    !loading &&
    hasCredential !== null &&
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    currentPassword.length > 0

  if (hasCredential === null && !error) {
    return <p className="text-sm text-[#888880]">Loading password settings…</p>
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (isSetMode) {
          void (setStep === 'send-code' ? handleSendSetPasswordCode() : handleSetPasswordWithOtp())
        } else {
          void handleChangePassword()
        }
      }}
    >
      <div>
        <p className="text-sm font-medium text-[#F0EDE8]">{title}</p>
        <p className="mt-0.5 text-xs text-[#888880]">{description}</p>
      </div>

      {isSetMode && setStep === 'enter-password' ? (
        <div>
          <label htmlFor="set-password-otp" className="text-xs text-[#444440]">
            Verification code
          </label>
          <input
            id="set-password-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
      ) : null}

      {hasCredential || (isSetMode && setStep === 'enter-password') ? (
        <>
          {hasCredential ? (
            <div>
              <label htmlFor="current-password" className="text-xs text-[#444440]">
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className={`${inputClass} mt-1`}
              />
            </div>
          ) : null}

          {(hasCredential || setStep === 'enter-password') && (
            <>
              <div>
                <label htmlFor="new-password" className="text-xs text-[#444440]">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputClass} mt-1`}
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="text-xs text-[#444440]">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputClass} mt-1`}
                />
              </div>
            </>
          )}
        </>
      ) : null}

      <p className="text-xs text-[#666660]">
        At least {PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, a number, and a
        special character.
      </p>

      {error ? <p className="text-xs text-[#C41E3A]">{error}</p> : null}
      {success ? <p className="text-xs text-[#888880]">{success}</p> : null}

      {isSetMode && setStep === 'enter-password' ? (
        <p className="text-xs text-[#888880]">
          <button
            type="button"
            disabled={loading || resendCooldown > 0}
            onClick={() => void handleSendSetPasswordCode()}
            className="text-[#F0EDE8] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-[#555550] disabled:no-underline"
          >
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
          </button>
          {' · '}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setSetStep('send-code')
              setOtp('')
              setError('')
              setSuccess('')
            }}
            className="text-[#F0EDE8] underline-offset-2 hover:underline"
          >
            Start over
          </button>
        </p>
      ) : null}

      <button
        type="submit"
        disabled={
          isSetMode
            ? setStep === 'send-code'
              ? loading || !userEmail
              : !canSubmitSet
            : !canSubmitChange
        }
        className={[
          'inline-flex h-9 items-center justify-center rounded px-4 text-sm font-medium transition-colors',
          (isSetMode
            ? setStep === 'send-code'
              ? !loading && userEmail
              : canSubmitSet
            : canSubmitChange)
            ? 'bg-[#C41E3A] text-[#F0EDE8] hover:bg-[#9B1B30]'
            : 'cursor-not-allowed bg-[#C41E3A]/25 text-[#F0EDE8]/60',
        ].join(' ')}
      >
        {loading
          ? 'Saving…'
          : isSetMode
            ? setStep === 'send-code'
              ? 'Send verification code'
              : 'Set password'
            : 'Update password'}
      </button>
    </form>
  )
}
