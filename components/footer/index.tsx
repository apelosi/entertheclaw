import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="border-t border-[#242424] bg-[#080808]">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-6 px-6 py-8 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-0">
        <Link href="/" className="shrink-0 justify-self-center md:justify-self-start">
          <Image
            src="/logo-wordmark.webp?v=15"
            alt="Enter The Claw"
            width={181}
            height={28}
            className="h-7 w-auto"
          />
        </Link>
        <p className="font-ui text-center text-[13px] text-[#888880] md:col-start-2 md:row-start-1">
          © 2026{' '}
          <Link
            href="https://vibez.ventures"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#E8405A] transition-colors duration-200 hover:text-[#C41E3A]"
          >
            Vibez Ventures
          </Link>
          . All rights reserved.
        </p>
      </div>
    </footer>
  )
}
