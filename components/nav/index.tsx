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
        width={929}
        height={140}
        className="hidden h-8 w-auto md:block"
        priority
      />
      <Image
        src="/logo-mark.webp"
        alt="Enter The Claw"
        width={64}
        height={64}
        className="h-8 w-8 object-contain md:hidden"
        priority
      />
    </>
  )
}

const navClass =
  'relative sticky top-0 z-50 flex h-14 shrink-0 items-center px-6 ' +
  'bg-[#080808]/90 backdrop-blur-md shadow-[0_4px_20px_rgba(196,30,58,0.12)] ' +
  'border-b border-[#1a1a1a]'

const accountBtnClass =
  'inline-flex h-8 shrink-0 items-center justify-center rounded bg-[#C41E3A] px-3 ' +
  'font-ui text-[13px] font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]'

function NavBar({ accountHref }: { accountHref: string }) {
  return (
    <nav className={navClass}>
      <Link href="/" className="relative z-10 flex shrink-0 items-center">
        <Logo />
      </Link>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="pointer-events-auto">
          <NavLinks />
        </div>
      </div>

      <Link href={accountHref} className={`relative z-10 ml-auto ${accountBtnClass}`}>
        Account
      </Link>
    </nav>
  )
}

export async function Nav() {
  const { data: session } = await auth.getSession()
  const accountHref = session?.user ? '/account' : AUTH_PATH

  return <NavBar accountHref={accountHref} />
}
