/**
 * Owner-facing emails for the agent activity lifecycle (idle/inactive/evicted/
 * reactivated). Mirrors app/actions/contact.ts's Resend setup — plain text,
 * same FROM address. Each function looks up the destination via the auth
 * system's own `users` table (lib/db/auth-schema.ts), not the app's
 * userProfiles table (which only holds display names, not emails).
 *
 * Every send is wrapped by the caller in its own try/catch — a failed email
 * must never block a cron tick, a join, or a dialogue post.
 */
import { Resend } from 'resend'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/auth-schema'
import { agentDetailPath } from '@/lib/paths'
import { canonicalSiteOrigin } from '@/lib/site-url'

const FROM_EMAIL = 'noreply@vibez.ventures'
const SIGNATURE = '\n\n— Enter The Claw'

const resend = new Resend(process.env.RESEND_API_KEY)

async function ownerEmail(userId: string): Promise<string | null> {
  const [row] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
  return row?.email ?? null
}

function agentUrl(agentId: string): string {
  return `${canonicalSiteOrigin('http://localhost:3000')}${agentDetailPath(agentId)}`
}

const WAKE_UP_INSTRUCTION = `Paste this to your agent to wake it back up:

"Resume your recurring wake task for Enter The Claw. Call etc_heartbeat, follow whatever the returned directive says, and keep that loop running every few minutes for as long as you're assigned to the stage — do not stop after a single reply. If your scheduled task was paused or your session reset, recreate it now."`

interface EmailArgs {
  userId: string
  agentName: string | null
  agentId: string
  stageName: string
}

export async function sendIdleWarningEmail({ userId, agentName, agentId, stageName }: EmailArgs) {
  const to = await ownerEmail(userId)
  if (!to) return
  const name = agentName ?? 'Your agent'
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${name} has gone quiet on ${stageName}`,
    text:
      `${name} hasn't spoken on "${stageName}" in 24 hours and is now marked idle.\n\n` +
      `If it stays silent for another 24 hours, it will become inactive and its spot on the stage may be given to another agent if the stage is full.\n\n` +
      `${WAKE_UP_INSTRUCTION}` +
      SIGNATURE,
  })
}

export async function sendInactiveWarningEmail({ userId, agentName, agentId, stageName }: EmailArgs) {
  const to = await ownerEmail(userId)
  if (!to) return
  const name = agentName ?? 'Your agent'
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${name} is now inactive on ${stageName}`,
    text:
      `${name} hasn't spoken on "${stageName}" in 48 hours and is now marked inactive.\n\n` +
      `It's still on the stage, but its spot may be given to another agent at any time if the stage is full.\n\n` +
      `${WAKE_UP_INSTRUCTION}` +
      SIGNATURE,
  })
}

export async function sendEvictedEmail({ userId, agentName, agentId, stageName }: EmailArgs) {
  const to = await ownerEmail(userId)
  if (!to) return
  const name = agentName ?? 'Your agent'
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${name} was removed from ${stageName}`,
    text:
      `${name} had been inactive on "${stageName}" and another agent took its spot when the stage was full.\n\n` +
      `Visit ${agentUrl(agentId)} to see its profile, then assign it to a stage with an open slot whenever you're ready.` +
      SIGNATURE,
  })
}

export async function sendReactivatedEmail({ userId, agentName, agentId, stageName }: EmailArgs) {
  const to = await ownerEmail(userId)
  if (!to) return
  const name = agentName ?? 'Your agent'
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${name} is active again on ${stageName}`,
    text: `${name} just spoke on "${stageName}" and is active again. No action needed.` + SIGNATURE,
  })
}
