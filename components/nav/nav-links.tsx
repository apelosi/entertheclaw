'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isNavActive, NAV_ITEMS } from '@/components/nav/nav-items'

export function NavLinks() {
  const pathname = usePathname()

  return (
    <ul className="hidden items-center gap-1 md:flex">
      {NAV_ITEMS.map((link) => {
        const active = isNavActive(link.href, pathname)
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={[
                'relative inline-flex h-9 w-28 items-center justify-center px-3',
                'font-ui text-[13px] font-medium uppercase tracking-[0.06em]',
                'transition-colors duration-100',
                'after:absolute after:inset-x-3 after:bottom-1 after:h-px',
                'after:origin-center after:scale-x-0',
                'after:transition-transform after:duration-150',
                active
                  ? 'text-[#C41E3A] hover:text-[#C41E3A] after:scale-x-100 after:bg-[#C41E3A]'
                  : 'text-[#888880] after:bg-[#F0EDE8] hover:text-[#F0EDE8] hover:after:scale-x-100',
              ].join(' ')}
            >
              {link.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
