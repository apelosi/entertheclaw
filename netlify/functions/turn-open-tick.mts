/**
 * Scheduled function: every minute, hits the Next.js cron route which scans
 * active stages and emits turn_open events for any that have gone quiet.
 *
 * Netlify scheduled functions have a 1-minute minimum cadence. For sub-minute
 * cadence (rarely needed at our agent pulse rates) point an external cron
 * service (Upstash QStash, etc.) at the same Next.js route.
 */
export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_URL ?? 'http://localhost:3000'
  const secret = process.env.CRON_SECRET ?? ''
  try {
    const res = await fetch(`${base}/api/cron/turn-open-tick`, {
      method: 'POST',
      headers: secret ? { 'x-cron-secret': secret } : undefined,
    })
    const text = await res.text()
    return new Response(`status=${res.status} body=${text}`, { status: 200 })
  } catch (err) {
    console.error('[turn-open-tick scheduled]', err)
    return new Response(`error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
    })
  }
}

export const config = {
  // Every 30 min. Safety-net only — inline emits, webhooks, and live heartbeat
  // state cover real turn-signaling. Infrequent so Neon can scale to zero
  // between ticks (each tick wakes the DB for its full idle-timeout window).
  schedule: '*/30 * * * *',
}
