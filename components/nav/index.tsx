import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from '@/lib/auth/get-server-session'
import { AUTH_PATH } from '@/lib/auth/paths'
import { MobileMenu } from '@/components/nav/mobile-menu'
import { NavLinks } from '@/components/nav/nav-links'

/** Intrinsic display size (source asset is 1960×303). Keeps layout sane if CSS fails to load. */
const WORDMARK_ASPECT = 1960 / 303

function wordmarkDimensions(heightPx: number) {
  return { width: Math.round(heightPx * WORDMARK_ASPECT), height: heightPx }
}

function Wordmark({
  className,
  heightPx = 32,
}: {
  className?: string
  heightPx?: 28 | 32
}) {
  const { width, height } = wordmarkDimensions(heightPx)
  return (
    <Image
      src="/logo-wordmark.webp?v=15"
      alt="Enter The Claw"
      width={width}
      height={height}
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
        <MobileMenu accountHref={accountHref} accountLabel={accountLabel} />
      </div>

      <Link href="/" className="relative z-10 hidden shrink-0 items-center md:flex">
        <Wordmark />
      </Link>

      <Link
        href="/"
        className="absolute left-1/2 z-10 flex -translate-x-1/2 items-center md:hidden"
      >
        <Wordmark
          heightPx={28}
          className="h-7 w-auto max-w-[min(52vw,220px)]"
        />
      </Link>

      <div className="pointer-events-none absolute inset-0 hidden items-center justify-center md:flex">
        <div className="pointer-events-auto">
          <NavLinks />
        </div>
      </div>

      <div className="relative z-10 ml-auto hidden md:block">
        <Link href={accountHref} className={accountBtnClass}>
          {accountLabel}
        </Link>
      </div>
    </nav>
  )
}

export async function Nav() {
  const { data: session } = await getServerSession()
  const isLoggedIn = Boolean(session?.user)
  const accountHref = isLoggedIn ? '/account' : AUTH_PATH
  const accountLabel = isLoggedIn ? 'Account' : 'Sign Up / In'

  return <NavBar accountHref={accountHref} accountLabel={accountLabel} />
}
