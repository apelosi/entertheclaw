'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { validateDisplayName } from '@/lib/auth/display-name'
import { HOME_PATH } from '@/lib/paths'

type DisplayNameFormProps = {
  initialName: string
  mode: 'onboarding' | 'account'
  callbackUrl?: string
}

export function DisplayNameForm({ initialName, mode, callbackUrl }: DisplayNameFormProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [savedName, setSavedName] = useState(initialName.trim())
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSavedName(initialName.trim())
  }, [initialName])

  const trimmedName = name.trim()
  const isDirty = trimmedName !== savedName
  const canSave = isDirty && trimmedName.length > 0 && !loading

  const inputClass =
    'h-10 w-full rounded border border-[#3A3A3A] bg-[#161616] px-3 text-sm text-[#F0EDE8] placeholder-[#444440] outline-none transition-colors focus:border-[#C41E3A]'

  async function handleSubmit() {
    setError('')
    setSuccess('')
    const validationError = validateDisplayName(name)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const result = await authClient.updateUser({ name: name.trim() })
      if (result.error) {
        setError(result.error.message ?? 'Could not save display name.')
        return
      }

      const profileRes = await fetch('/api/account/display-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmedName }),
      })
      if (!profileRes.ok) {
        setError('Display name saved to account but could not publish it publicly. Try again.')
        return
      }

      if (mode === 'onboarding') {
        window.location.assign(callbackUrl ?? HOME_PATH)
        return
      }

      setSavedName(trimmedName)
      setName(trimmedName)
      setSuccess('Display name saved.')
      router.refresh()
    } catch {
      setError('Could not save display name. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit()
      }}
    >
      <div>
        {mode === 'account' ? (
          <label htmlFor="display-name" className="text-xs text-[#444440]">
            Display name
          </label>
        ) : null}
        <input
          id="display-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your display name"
          autoComplete="nickname"
          maxLength={64}
          className={`${inputClass} ${mode === 'account' ? 'mt-1' : ''}`}
        />
      </div>
      {error ? <p className="text-xs text-[#C41E3A]">{error}</p> : null}
      {success ? <p className="text-xs text-[#888880]">{success}</p> : null}
      <button
        type="submit"
        disabled={
          loading ||
          !trimmedName ||
          (mode === 'account' ? !isDirty : false)
        }
        className={
          mode === 'onboarding'
            ? 'h-10 w-full rounded bg-[#C41E3A] text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30] disabled:opacity-50'
            : [
                'inline-flex h-9 items-center justify-center rounded px-4 text-sm font-medium transition-colors',
                canSave
                  ? 'bg-[#C41E3A] text-[#F0EDE8] hover:bg-[#9B1B30]'
                  : 'cursor-not-allowed bg-[#C41E3A]/25 text-[#F0EDE8]/60',
              ].join(' ')
        }
      >
        {loading ? 'Saving…' : mode === 'onboarding' ? 'Continue' : 'Save'}
      </button>
    </form>
  )
}
