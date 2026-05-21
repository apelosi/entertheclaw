import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'
import { AUTH_PATH } from '@/lib/auth/paths'
import { AccountMenu } from './account-menu'

function Logo() {
  return (
    <>
      <Image
        src="/logo-wordmark.webp"
        alt="Enter The Claw"
        width={2048}
        height={1024}
        className="hidden h-8 w-auto md:block"
        priority
      />
      <Image
        src="/logo-mark.webp"
        alt="Enter The Claw"
        width={32}
        height={32}
        className="h-8 w-8 object-contain md:hidden"
        priority
      />
    </>
  )
}

const NAV_LINKS_LOGGED_OUT = [
  { href: '/', label: 'Home' },
  { href: '/stages', label: 'Stages' },
  { href: '/agents', label: 'Agents' },
  { href: '/characters', label: 'Characters' },
]

const NAV_LINKS_LOGGED_IN = [
  { href: '/', label: 'Home' },
  { href: '/stages', label: 'Stages' },
  { href: '/agents', label: 'Agents' },
  { href: '/characters', label: 'Characters' },
]

const navClass =
  'sticky top-0 z-50 flex h-14 items-center justify-between px-6 ' +
  'bg-[#080808]/90 backdrop-blur-md shadow-[0_4px_20px_rgba(196,30,58,0.12)] ' +
  'border-b border-[#1a1a1a]'

const linkClass =
  'font-ui text-[13px] font-medium text-[#888880] transition-colors duration-200 ' +
  'hover:text-[#C41E3A]'

function NavLoggedOut() {
  return (
    <nav className={navClass}>
      {/* Logo */}
      <Link href="/" className="flex items-center">
        <Logo />
      </Link>

      {/* Links */}
      <ul className="hidden items-center gap-8 md:flex">
        {NAV_LINKS_LOGGED_OUT.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={linkClass}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Auth */}
      <Link
        href={AUTH_PATH}
        className="inline-flex h-8 items-center justify-center rounded bg-[#C41E3A] px-3 font-ui text-[13px] font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]"
      >
        Sign in / up
      </Link>
    </nav>
  )
}

function NavLoggedIn({ userDisplayName }: { userDisplayName: string }) {
  return (
    <nav className={navClass}>
      {/* Logo */}
      <Link href="/" className="flex items-center">
        <Logo />
      </Link>

      {/* Links */}
      <ul className="hidden items-center gap-8 md:flex">
        {NAV_LINKS_LOGGED_IN.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={linkClass}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <AccountMenu userDisplayName={userDisplayName} />
    </nav>
  )
}

export async function Nav() {
  const { data: session } = await auth.getSession()

  if (!session?.user) {
    return <NavLoggedOut />
  }

  const displayName =
    session.user.name ?? session.user.email?.split('@')[0] ?? 'Account'

  return <NavLoggedIn userDisplayName={displayName} />
}
