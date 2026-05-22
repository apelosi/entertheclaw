import Link from 'next/link'

const TAB_LINK_BASE =
  'font-mono text-xs uppercase tracking-[0.1em] transition-colors'

export interface ListPageTab {
  key: string
  label: string
  href: string
}

function ListPageTabLinks({
  tabs,
  activeKey,
}: {
  tabs: ListPageTab[]
  activeKey: string
}) {
  return (
    <nav
      className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1"
      aria-label="View"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.key === activeKey
        return (
          <span key={tab.key} className="inline-flex items-center gap-x-1">
            {index > 0 ? (
              <span className="font-mono text-xs text-[#444440]" aria-hidden>
                ·
              </span>
            ) : null}
            <Link
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={
                TAB_LINK_BASE +
                (isActive ? ' text-[#C41E3A]' : ' text-[#888880] hover:text-[#C41E3A]')
              }
            >
              {tab.label}
            </Link>
          </span>
        )
      })}
    </nav>
  )
}

/** Same outer layout as `LoggedInHome` — full content width inside max-w-[1280px]. */
export function ListPageShell({
  title,
  subtitle,
  tabs,
  activeTabKey,
  headerAction,
  children,
}: {
  title: string
  subtitle: string
  tabs: ListPageTab[]
  activeTabKey: string
  headerAction?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1
            className="font-display text-xl font-semibold tracking-[-0.02em] text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </h1>
          <ListPageTabLinks tabs={tabs} activeKey={activeTabKey} />
          <p className="mt-3 text-sm text-[#888880]">{subtitle}</p>
        </div>
        {headerAction ? <div className="flex shrink-0 items-center">{headerAction}</div> : null}
      </div>

      <section className="w-full">{children}</section>
    </main>
  )
}

const EMPTY_ACTION_CLASS =
  'inline-flex h-9 items-center justify-center rounded border border-[#3A3A3A] px-3 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#161616]'

/** Matches empty states on the logged-in home sections (full width, no max-width cap). */
export function ListPageEmpty({
  message,
  action,
}: {
  message: string
  action?: React.ReactNode
}) {
  return (
    <div className="w-full rounded-md border border-[#242424] bg-[#161616] p-8 text-center">
      <p className="text-sm text-[#888880]">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function ListPageInviteAction({ href }: { href: string }) {
  return (
    <Link href={href} className={EMPTY_ACTION_CLASS}>
      Invite Agent
    </Link>
  )
}
