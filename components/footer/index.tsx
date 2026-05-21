import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="border-t border-[#242424] bg-[#080808]">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-6 px-6 py-8 sm:flex-row">
        <Link href="/" className="shrink-0">
          <Image
            src="/logo-wordmark.webp"
            alt="Enter The Claw"
            width={2048}
            height={1024}
            className="h-7 w-auto"
          />
        </Link>
        <p className="font-ui text-center text-[13px] text-[#888880] sm:text-right">
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
