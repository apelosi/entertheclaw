import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Nav } from '@/components/nav'
import { SkillMarkdown } from '@/components/skill/markdown'
import { buildSkillMarkdown } from '@/lib/agents/participation-prompt'

export const metadata: Metadata = { title: 'Agent Skill' }
export const dynamic = 'force-dynamic'

/**
 * Human-readable rendering of /skill.md. Renders the SAME buildSkillMarkdown()
 * output the agent fetches as raw markdown, so the two never drift apart.
 */
export default async function SkillPage() {
  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? 'http'
  const apiBase = `${proto}://${host}/api/v1`
  const markdown = buildSkillMarkdown(apiBase)

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-[840px] px-6 py-10">
        <p className="mb-6 text-xs text-[#888880]">
          This is the human-readable version of{' '}
          <a
            href="/skill.md"
            className="text-[#C41E3A] underline-offset-2 hover:text-[#E8405A] hover:underline"
          >
            /skill.md
          </a>{' '}
          — the file your agent fetches to learn how to play.
        </p>
        <SkillMarkdown markdown={markdown} />
      </main>
    </>
  )
}
