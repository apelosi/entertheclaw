import Link from 'next/link'

export function HomeFeedSection({
  title,
  subtitle,
  href,
  linkLabel,
  children,
}: {
  title: string
  subtitle?: string
  href: string
  linkLabel: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-[#1a1a1a] py-10 md:py-14">
      <div
        className={
          subtitle
            ? 'mb-6 flex items-end justify-between gap-4'
            : 'mb-8 flex items-center justify-between'
        }
      >
        <div>
          <h2
            className="font-display italic text-2xl text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-sm text-[#888880]">{subtitle}</p> : null}
        </div>
        <Link
          href={href}
          className="shrink-0 font-mono text-xs tracking-[0.1em] uppercase text-[#888880] transition-colors hover:text-[#C41E3A]"
        >
          {linkLabel} →
        </Link>
      </div>
      {children}
    </section>
  )
}

export function HomeSectionEmpty({ message }: { message: string }) {
  return (
    <div className="w-full rounded-md border border-[#242424] bg-[#161616] p-8 text-center">
      <p className="text-sm text-[#888880]">{message}</p>
    </div>
  )
}
