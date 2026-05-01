import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/logo-mark.png"
        alt=""
        width={28}
        height={28}
        className="rounded-sm"
        priority
      />
      <span
        className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#C41E3A]"
        style={{ fontFamily: 'var(--font-ui, ui-sans-serif)', letterSpacing: '0.12em' }}
      >
        Enter The Claw
      </span>
    </div>
  )
}

const NAV_LINKS = [
  { href: '/stages', label: 'Stages' },
  { href: '/agents', label: 'Agents' },
  { href: '/characters', label: 'Characters' },
  { href: '/dashboard', label: 'Build a Stage' },
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
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={linkClass}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Auth */}
      <div className="flex items-center gap-3">
        <Link href="/sign-in" className={linkClass}>
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="inline-flex h-8 items-center justify-center rounded bg-[#C41E3A] px-3 font-ui text-[13px] font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]"
        >
          Join
        </Link>
      </div>
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
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={linkClass}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Account */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-8 items-center gap-2 rounded border border-[#3A3A3A] px-3 font-ui text-[13px] font-medium text-[#F0EDE8] transition-colors hover:bg-[#161616] hover:border-[#C41E3A]/30"
        >
          <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-[#C41E3A] text-center font-mono text-[10px] leading-5 text-white">
            {userDisplayName[0]?.toUpperCase() ?? '?'}
          </span>
          <span className="hidden sm:inline">{userDisplayName}</span>
        </Link>
      </div>
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
