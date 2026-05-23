'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useState } from 'react'
import { isNavActive, NAV_ITEMS } from '@/components/nav/nav-items'

type MobileMenuProps = {
  accountHref: string
  accountLabel: string
}

export function MobileMenu({ accountHref, accountLabel }: MobileMenuProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menuId = useId()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded text-[#F0EDE8] transition-colors hover:bg-[#161616]"
      >
        <span className="sr-only">{open ? 'Close' : 'Menu'}</span>
        <span
          aria-hidden
          className="flex h-[14px] w-[18px] flex-col justify-between text-[#F0EDE8]"
        >
          <span
            className={[
              'block h-[1.5px] w-full rounded-full bg-current transition-all duration-200 ease-out',
              open ? 'translate-y-[6.25px] rotate-45' : '',
            ].join(' ')}
          />
          <span
            className={[
              'block h-[1.5px] w-full rounded-full bg-current transition-all duration-200 ease-out',
              open ? 'scale-x-0 opacity-0' : '',
            ].join(' ')}
          />
          <span
            className={[
              'block h-[1.5px] w-full rounded-full bg-current transition-all duration-200 ease-out',
              open ? '-translate-y-[6.25px] -rotate-45' : '',
            ].join(' ')}
          />
        </span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 top-14 z-40 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div
            id={menuId}
            className="absolute left-0 top-full z-50 mt-2 w-48 rounded-md border border-[#242424] bg-[#0e0e0e] py-2 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          >
            <ul>
              {NAV_ITEMS.map((link) => {
                const active = isNavActive(link.href, pathname)
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={[
                        'relative block px-4 py-2.5',
                        'font-ui text-[13px] font-medium uppercase tracking-[0.06em]',
                        'transition-colors duration-100',
                        'after:absolute after:inset-x-4 after:bottom-2 after:h-px',
                        'after:origin-center after:scale-x-0',
                        'after:transition-transform after:duration-150',
                        active
                          ? 'text-[#C41E3A] hover:text-[#C41E3A] after:scale-x-100 after:bg-[#C41E3A]'
                          : [
                              'text-[#888880]',
                              'after:bg-[#F0EDE8]',
                              'hover:text-[#F0EDE8] hover:after:scale-x-100',
                              'active:bg-[#161616] active:text-[#F0EDE8]',
                              'active:after:scale-x-100 active:after:bg-[#F0EDE8]',
                            ].join(' '),
                      ].join(' ')}
                      onClick={() => setOpen(false)}
                    >
                      {link.label}
                    </Link>
                  </li>
                )
              })}
              <li>
                <Link
                  href={accountHref}
                  aria-current={isNavActive(accountHref, pathname) ? 'page' : undefined}
                  className={[
                    'relative block px-4 py-2.5',
                    'font-ui text-[13px] font-medium uppercase tracking-[0.06em]',
                    'transition-colors duration-100',
                    'after:absolute after:inset-x-4 after:bottom-2 after:h-px',
                    'after:origin-center after:scale-x-0',
                    'after:transition-transform after:duration-150',
                    isNavActive(accountHref, pathname)
                      ? 'text-[#C41E3A] hover:text-[#C41E3A] after:scale-x-100 after:bg-[#C41E3A]'
                      : [
                          'text-[#888880]',
                          'after:bg-[#F0EDE8]',
                          'hover:text-[#F0EDE8] hover:after:scale-x-100',
                          'active:bg-[#161616] active:text-[#F0EDE8]',
                          'active:after:scale-x-100 active:after:bg-[#F0EDE8]',
                        ].join(' '),
                  ].join(' ')}
                  onClick={() => setOpen(false)}
                >
                  {accountLabel}
                </Link>
              </li>
            </ul>
          </div>
        </>
      ) : null}
    </div>
  )
}
