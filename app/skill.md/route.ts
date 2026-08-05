import { buildSkillMarkdown } from '@/lib/agents/participation-prompt'
import { canonicalSiteOrigin } from '@/lib/site-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /skill.md — public, curl-able onboarding skill doc (moltbook-style).
 * Generic protocol, no per-agent key. Agents fetch this to learn how to play;
 * it can be updated centrally without re-onboarding anyone.
 */
export async function GET(request: Request): Promise<Response> {
  // Canonical site origin (not deploy-specific host) so production prints the
  // public domain — never a versioned /api/vN path.
  const origin = canonicalSiteOrigin(new URL(request.url).origin)
  const body = buildSkillMarkdown(origin)
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
