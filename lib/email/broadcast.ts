/**
 * Transactional owner broadcasts — send one plain-text email to a chosen set of
 * users (a single owner, a list, all agent owners, or every registered user).
 * Reuses the same Resend setup and FROM address as the activity emails
 * (agent-activity-emails.ts). Intended for one-off operational sends (e.g. a
 * "your agent's MCP version is out of date, here's how to upgrade" notice),
 * driven by scripts/notify-owners.ts — NOT wired into any automatic flow.
 *
 * Recipient emails come from the auth system's own `users` table
 * (lib/db/auth-schema.ts → neon_auth."user"), joined to `agents.userId`.
 */
import { Resend } from 'resend'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/auth-schema'
import { agents } from '@/lib/db/schema'

const FROM_EMAIL = 'noreply@vibez.ventures'

export interface RecipientSelector {
  /** Explicit email addresses (used as-is). */
  emails?: string[]
  /** Resolve emails for these auth user ids. */
  userIds?: string[]
  /** Resolve owner emails for these agent ids. */
  agentIds?: string[]
  /** Every user who owns at least one agent. */
  allOwners?: boolean
  /** Every registered user (agent or not). */
  allUsers?: boolean
}

export interface Recipient {
  email: string
  userId?: string
}

/** Resolve a selector to a de-duplicated recipient list (dedup by lowercased email). */
export async function resolveRecipients(sel: RecipientSelector): Promise<Recipient[]> {
  const out = new Map<string, Recipient>()
  const add = (email: string | null | undefined, userId?: string) => {
    const e = email?.trim().toLowerCase()
    if (!e) return
    if (!out.has(e)) out.set(e, { email: e, ...(userId ? { userId } : {}) })
  }

  for (const e of sel.emails ?? []) add(e)

  if (sel.userIds?.length) {
    const rows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.id, sel.userIds))
    for (const r of rows) add(r.email, r.id)
  }

  if (sel.agentIds?.length) {
    const rows = await db
      .select({ email: users.email, userId: agents.userId })
      .from(agents)
      .innerJoin(users, eq(users.id, agents.userId))
      .where(inArray(agents.id, sel.agentIds))
    for (const r of rows) add(r.email, r.userId)
  }

  if (sel.allOwners) {
    const rows = await db
      .selectDistinct({ email: users.email, userId: agents.userId })
      .from(agents)
      .innerJoin(users, eq(users.id, agents.userId))
    for (const r of rows) add(r.email, r.userId)
  }

  if (sel.allUsers) {
    const rows = await db.select({ id: users.id, email: users.email }).from(users)
    for (const r of rows) add(r.email, r.id)
  }

  return [...out.values()]
}

export interface BroadcastResult {
  planned: number
  sent: number
  failed: Array<{ email: string; error: string }>
}

/**
 * Send `subject`/`text` to each recipient individually (never a shared To/BCC,
 * so addresses aren't leaked between owners). Sequential with a small delay to
 * stay gentle on Resend's rate limit. When `dryRun` is true, sends nothing and
 * just reports what would be sent.
 */
export async function sendOwnerBroadcast(opts: {
  recipients: Recipient[]
  subject: string
  text: string
  dryRun?: boolean
  delayMs?: number
}): Promise<BroadcastResult> {
  const { recipients, subject, text, dryRun = true, delayMs = 120 } = opts
  const result: BroadcastResult = { planned: recipients.length, sent: 0, failed: [] }
  if (dryRun) return result

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not set — cannot send.')
  const resend = new Resend(apiKey)

  for (const r of recipients) {
    try {
      const { error } = await resend.emails.send({ from: FROM_EMAIL, to: r.email, subject, text })
      if (error) throw new Error(typeof error === 'string' ? error : JSON.stringify(error))
      result.sent++
    } catch (err) {
      result.failed.push({ email: r.email, error: err instanceof Error ? err.message : String(err) })
    }
    if (delayMs > 0) await new Promise((res) => setTimeout(res, delayMs))
  }
  return result
}
