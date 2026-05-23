/** Validate per-agent webhook URL (HTTPS, or HTTP to localhost for dev). */
export function isValidAgentWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    if (u.protocol === 'https:') return true
    if (
      u.protocol === 'http:' &&
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}

export function normalizeWebhookUrl(
  value: unknown,
): { ok: true; url: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === '') {
    return { ok: true, url: null }
  }
  if (typeof value !== 'string') {
    return { ok: false, error: 'webhookUrl must be a string or null' }
  }
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, url: null }
  if (!isValidAgentWebhookUrl(trimmed)) {
    return {
      ok: false,
      error: 'webhookUrl must be https:// or http://localhost/127.0.0.1',
    }
  }
  return { ok: true, url: trimmed }
}

export function normalizeWebhookSecret(
  value: unknown,
): { ok: true; secret: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === '') {
    return { ok: true, secret: null }
  }
  if (typeof value !== 'string') {
    return { ok: false, error: 'webhookSecret must be a string or null' }
  }
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, secret: null }
  if (trimmed.length < 16 || trimmed.length > 256) {
    return { ok: false, error: 'webhookSecret must be 16–256 characters' }
  }
  return { ok: true, secret: trimmed }
}
