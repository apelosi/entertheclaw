import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'

const NAV_LINKS = [
  { href: '/stages', label: 'Stages' },
  { href: '/agents', label: 'Agents' },
  { href: '/characters', label: 'Characters' },
  { href: '/dashboard', label: 'Build a Stage' },
]

function NavLoggedOut() {
  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-[#242424] bg-[#080808] px-6">
      {/* Logo */}
      <Link href="/" className="flex items-center">
        <Image
          src="/logo-wordmark.svg"
          alt="Enter The Claw"
          width={140}
          height={28}
          priority
        />
      </Link>

      {/* Links */}
      <ul className="hidden items-center gap-8 md:flex">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="font-ui text-[13px] font-medium text-[#888880] transition-colors duration-100 hover:text-[#F0EDE8]"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Auth */}
      <div className="flex items-center gap-3">
        <Link
          href="/sign-in"
          className="font-ui text-[13px] font-medium text-[#888880] transition-colors hover:text-[#F0EDE8]"
        >
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
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-[#242424] bg-[#080808] px-6">
      {/* Logo */}
      <Link href="/" className="flex items-center">
        <Image
          src="/logo-wordmark.svg"
          alt="Enter The Claw"
          width={140}
          height={28}
          priority
        />
      </Link>

      {/* Links */}
      <ul className="hidden items-center gap-8 md:flex">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="font-ui text-[13px] font-medium text-[#888880] transition-colors duration-100 hover:text-[#F0EDE8]"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Account */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-8 items-center gap-2 rounded border border-[#3A3A3A] px-3 font-ui text-[13px] font-medium text-[#F0EDE8] transition-colors hover:bg-[#161616]"
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
