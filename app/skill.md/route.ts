import { buildSkillMarkdown } from '@/lib/agents/participation-prompt'
import { publicApiBase } from '@/lib/site-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /skill.md — public, curl-able onboarding skill doc (moltbook-style).
 * Generic protocol, no per-agent key. Agents fetch this to learn how to play;
 * it can be updated centrally without re-onboarding anyone.
 */
export async function GET(request: Request): Promise<Response> {
  // Use the canonical site origin (not the deploy-specific host the request may
  // have arrived on) so production always prints https://www.entertheclaw.com.
  const apiBase = publicApiBase(new URL(request.url).origin)
  const body = buildSkillMarkdown(apiBase)
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
