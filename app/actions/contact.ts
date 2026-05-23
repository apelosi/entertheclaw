'use server'

import { headers } from 'next/headers'
import { db } from '@/lib/db/client'
import { contactSubmissions } from '@/lib/db/schema'
import { count, gte, eq, and } from 'drizzle-orm'
import { Resend } from 'resend'

const STAFF_EMAIL = 'entertheclaw@vibez.ventures'
const FROM_EMAIL = 'noreply@vibez.ventures'
const RATE_LIMIT_PER_HOUR = 3

const resend = new Resend(process.env.RESEND_API_KEY)

export type ContactResult = { ok: true } | { ok: false; error: string }

export async function submitContact(formData: FormData): Promise<ContactResult> {
  const honeypot = formData.get('website')
  if (honeypot) {
    // Bot caught — silently return success so the trap isn't revealed
    return { ok: true }
  }

  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const subject = (formData.get('subject') as string | null)?.trim() ?? ''
  const message = (formData.get('message') as string | null)?.trim() ?? ''

  if (!email || !subject || !message) {
    return { ok: false, error: 'All fields are required.' }
  }

  // Get client IP from forwarded header (Netlify sets x-forwarded-for)
  const headerStore = await headers()
  const forwarded = headerStore.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

  // Rate limit: max 3 submissions per IP per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const [{ value: recentCount }] = await db
    .select({ value: count() })
    .from(contactSubmissions)
    .where(
      and(
        eq(contactSubmissions.ipAddress, ip),
        gte(contactSubmissions.createdAt, oneHourAgo),
      ),
    )

  if (recentCount >= RATE_LIMIT_PER_HOUR) {
    return { ok: false, error: 'Too many submissions. Please try again later.' }
  }

  // Store submission (provides audit trail for future reference)
  await db.insert(contactSubmissions).values({ email, subject, message, ipAddress: ip })

  const subjectLine = `[Contact Form] ${subject}`

  // Send both emails in parallel
  await Promise.all([
    resend.emails.send({
      from: FROM_EMAIL,
      to: STAFF_EMAIL,
      subject: subjectLine,
      text: `From: ${email}\n\n${message}`,
    }),
    resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: subjectLine,
      text: `Thanks for reaching out. We received your message and will get back to you soon.\n\n— Enter The Claw`,
    }),
  ])

  return { ok: true }
}
