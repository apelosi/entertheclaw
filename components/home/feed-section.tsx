import Link from 'next/link'

export function HomeFeedSection({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string
  href: string
  linkLabel: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-[#1a1a1a] py-10 md:py-14">
      <div className="mb-8 flex items-center justify-between">
        <h2
          className="font-display italic text-2xl text-[#F0EDE8]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h2>
        <Link
          href={href}
          className="font-mono text-xs tracking-[0.1em] uppercase text-[#888880] transition-colors hover:text-[#C41E3A]"
        >
          {linkLabel} →
        </Link>
      </div>
      {children}
    </section>
  )
}
