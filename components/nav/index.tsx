import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'
import { AUTH_PATH } from '@/lib/auth/paths'
import { NavLinks } from '@/components/nav/nav-links'

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

const navClass =
  'sticky top-0 z-50 flex h-14 items-center justify-between px-6 ' +
  'bg-[#080808]/90 backdrop-blur-md shadow-[0_4px_20px_rgba(196,30,58,0.12)] ' +
  'border-b border-[#1a1a1a]'

const accountBtnClass =
  'inline-flex h-8 items-center justify-center rounded bg-[#C41E3A] px-3 ' +
  'font-ui text-[13px] font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]'

function NavLoggedOut() {
  return (
    <nav className={navClass}>
      {/* Logo */}
      <Link href="/" className="flex items-center">
        <Logo />
      </Link>

      <NavLinks />

      <Link href={AUTH_PATH} className={accountBtnClass}>
        Account
      </Link>
    </nav>
  )
}

function NavLoggedIn() {
  return (
    <nav className={navClass}>
      {/* Logo */}
      <Link href="/" className="flex items-center">
        <Logo />
      </Link>

      <NavLinks />

      <Link href="/account" className={accountBtnClass}>
        Account
      </Link>
    </nav>
  )
}

export async function Nav() {
  const { data: session } = await auth.getSession()

  if (!session?.user) {
    return <NavLoggedOut />
  }

  return <NavLoggedIn />
}
