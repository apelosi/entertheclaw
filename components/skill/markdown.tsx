'use client'

import ReactMarkdown, { type Components } from 'react-markdown'

/**
 * Renders the /skill.md markdown to rich text styled to match the rest of the
 * site (same palette as the old Agent Instructions page). The markdown source
 * is buildSkillMarkdown() — the SAME function /skill.md serves — so this page
 * never drifts out of sync.
 */
const components: Components = {
  h1: ({ children }) => (
    <h1
      className="font-display text-[32px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className="mt-10 mb-3 font-display text-[24px] font-light italic text-[#F0EDE8]"
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-7 mb-2 text-[15px] font-semibold text-[#F0EDE8]">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="my-3 text-[15px] leading-relaxed text-[#C8C4BC]">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-[#C8C4BC]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-[#C8C4BC]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-[#F0EDE8]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-[#C8C4BC]">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-[#C41E3A] underline-offset-2 hover:text-[#E8405A] hover:underline"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-8 border-[#242424]" />,
  code: ({ children }) => (
    <code className="rounded-sm bg-[#0D0D0D] px-1.5 py-0.5 font-mono text-[12.5px] text-[#F0EDE8]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-sm border border-[#242424] bg-[#0D0D0D] p-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-[#F0EDE8]">
      {children}
    </pre>
  ),
}

export function SkillMarkdown({ markdown }: { markdown: string }) {
  return <ReactMarkdown components={components}>{markdown}</ReactMarkdown>
}
