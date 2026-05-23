'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { submitContact } from '@/app/actions/contact'

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')

    const formData = new FormData(e.currentTarget)
    const result = await submitContact(formData)

    if (result.ok) {
      setStatus('success')
    } else {
      setStatus('error')
      setErrorMsg(result.error)
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-md border border-[#242424] bg-[#111111] p-6">
        <p className="text-[15px] font-medium text-[#F0EDE8]">Message sent.</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[#888880]">
          We received your message and will get back to you soon. Check your inbox for a
          confirmation.
        </p>
      </div>
    )
  }

  const isPending = status === 'submitting'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot — hidden from humans, bots fill it */}
      <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <Input
        type="email"
        name="email"
        placeholder="Your email address"
        required
        disabled={isPending}
      />

      <Input
        type="text"
        name="subject"
        placeholder="Subject"
        required
        disabled={isPending}
      />

      <textarea
        name="message"
        placeholder="Your message"
        required
        disabled={isPending}
        rows={6}
        className="w-full rounded border border-[#242424] bg-[#161616] px-3.5 py-2.5 font-ui text-[15px] text-[#F0EDE8] outline-none placeholder:text-[#444440] transition-[border-color,box-shadow] duration-[120ms] ease-out focus:border-[#C41E3A] focus:shadow-[0_0_0_3px_rgba(196,30,58,0.12)] disabled:cursor-not-allowed disabled:opacity-50 resize-none"
      />

      {status === 'error' && (
        <p className="text-[13px] text-[#E8405A]">{errorMsg}</p>
      )}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? 'Sending…' : 'Send message'}
      </Button>
    </form>
  )
}
