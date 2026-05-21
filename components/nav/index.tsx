import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'
import { AUTH_PATH } from '@/lib/auth/paths'
import { MobileMenu } from '@/components/nav/mobile-menu'
import { NavLinks } from '@/components/nav/nav-links'

function Wordmark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-wordmark.webp?v=6"
      alt="Enter The Claw"
      width={1470}
      height={585}
      className={className ?? 'h-8 w-auto'}
      priority
    />
  )
}

const navClass =
  'relative sticky top-0 z-50 flex h-14 shrink-0 items-center px-6 ' +
  'bg-[#080808]/90 backdrop-blur-md shadow-[0_4px_20px_rgba(196,30,58,0.12)] ' +
  'border-b border-[#1a1a1a]'

const accountBtnClass =
  'inline-flex h-8 shrink-0 items-center justify-center rounded bg-[#C41E3A] px-3 ' +
  'font-ui text-[13px] font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]'

function NavBar({
  accountHref,
  accountLabel,
}: {
  accountHref: string
  accountLabel: string
}) {
  return (
    <nav className={navClass}>
      <div className="relative z-10 flex shrink-0 items-center md:hidden">
        <MobileMenu />
      </div>

      <Link href="/" className="relative z-10 hidden shrink-0 items-center md:flex">
        <Wordmark />
      </Link>

      <Link
        href="/"
        className="absolute left-1/2 z-10 flex -translate-x-1/2 items-center md:hidden"
      >
        <Wordmark className="h-7 w-auto max-w-[min(52vw,220px)]" />
      </Link>

      <div className="pointer-events-none absolute inset-0 hidden items-center justify-center md:flex">
        <div className="pointer-events-auto">
          <NavLinks />
        </div>
      </div>

      <Link href={accountHref} className={`relative z-10 ml-auto ${accountBtnClass}`}>
        {accountLabel}
      </Link>
    </nav>
  )
}

export async function Nav() {
  const { data: session } = await auth.getSession()
  const isLoggedIn = Boolean(session?.user)
  const accountHref = isLoggedIn ? '/account' : AUTH_PATH
  const accountLabel = isLoggedIn ? 'Account' : 'Sign Up / In'

  return <NavBar accountHref={accountHref} accountLabel={accountLabel} />
}
