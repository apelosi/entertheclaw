/**
 * Best-effort POST of turn_open / turn_grant to per-agent webhook URLs.
 * Heartbeat and SSE remain the catch-up path when delivery fails.
 */
import { createHmac } from 'crypto'
import { db } from '@/lib/db/client'
import { agents, stageParticipants } from '@/lib/db/schema'
import { and, eq, isNotNull } from 'drizzle-orm'
import type { TurnOpenContent } from './emit-turn-open'
import type { GrantContent } from './turn-state'

const WEBHOOK_TIMEOUT_MS = 8_000

export type TurnWebhookType = 'turn_open' | 'turn_grant'

export interface TurnWebhookPayload {
  type: TurnWebhookType
  stageId: string
  eventId: string
  createdAt: string
  content: TurnOpenContent | GrantContent
}

interface WebhookTarget {
  agentId: string
  webhookUrl: string
  webhookSecret: string | null
}

async function loadWebhookTargets(stageId: string): Promise<WebhookTarget[]> {
  const rows = await db
    .select({
      agentId: agents.id,
      webhookUrl: agents.webhookUrl,
      webhookSecret: agents.webhookSecret,
    })
    .from(stageParticipants)
    .innerJoin(agents, eq(agents.id, stageParticipants.agentId))
    .where(
      and(
        eq(stageParticipants.stageId, stageId),
        isNotNull(agents.webhookUrl),
      ),
    )

  return rows
    .filter((r): r is typeof r & { webhookUrl: string } => !!r.webhookUrl?.trim())
    .map((r) => ({
      agentId: r.agentId,
      webhookUrl: r.webhookUrl.trim(),
      webhookSecret: r.webhookSecret ?? null,
    }))
}

function signBody(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

async function postWebhook(target: WebhookTarget, body: string): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'EnterTheClaw-Webhook/1',
  }
  if (target.webhookSecret) {
    headers['X-ETC-Signature'] = `sha256=${signBody(target.webhookSecret, body)}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
  try {
    const res = await fetch(target.webhookUrl, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    })
    if (!res.ok) {
      console.warn(
        `[turn-webhook] ${target.agentId} HTTP ${res.status} from ${target.webhookUrl}`,
      )
    }
  } catch (err) {
    console.warn(`[turn-webhook] ${target.agentId} delivery failed:`, err)
  } finally {
    clearTimeout(timeoutId)
  }
}

/** Fire-and-forget: notify all stage participants with a registered webhook URL. */
export function deliverTurnWebhooks(
  stageId: string,
  payload: TurnWebhookPayload,
): void {
  void (async () => {
    const targets = await loadWebhookTargets(stageId)
    if (targets.length === 0) return
    const body = JSON.stringify(payload)
    await Promise.allSettled(targets.map((t) => postWebhook(t, body)))
  })()
}
