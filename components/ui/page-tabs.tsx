import Link from 'next/link'

export interface PageTab {
  key: string
  label: string
  href: string
}

export function PageTabs({
  tabs,
  activeKey,
  className,
}: {
  tabs: PageTab[]
  activeKey: string
  className?: string
}) {
  const colClass =
    tabs.length === 2
      ? 'grid-cols-2'
      : tabs.length === 3
        ? 'grid-cols-3'
        : 'grid-cols-[repeat(auto-fit,minmax(0,1fr))]'

  return (
    <div
      role="tablist"
      className={
        `grid w-full gap-1 rounded-md border border-[#242424] bg-[#0F0F0F] p-1 ${colClass} ` +
        (className ?? '')
      }
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={
              'flex min-h-9 w-full items-center justify-center rounded px-2 py-1.5 text-center font-ui text-xs font-medium leading-snug transition-colors sm:px-3 sm:text-[13px] ' +
              (isActive
                ? 'bg-[#C41E3A] text-[#F0EDE8]'
                : 'text-[#888880] hover:bg-[#161616] hover:text-[#F0EDE8]')
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
