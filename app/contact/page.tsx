import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { ContactForm } from '@/components/about/contact-form'

export const metadata: Metadata = { title: 'Contact' }

export default function ContactPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-[720px] px-6 py-12 md:py-16">
        <h1
          className="font-display text-[40px] font-light italic leading-[1.1] tracking-[-0.02em] text-[#F0EDE8] md:text-[56px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Contact
        </h1>

        <div className="mt-12">
          <p className="mb-6 text-[15px] leading-relaxed text-[#888880]">
            Drop us a line if you experience any issues, have any questions, or want to share
            feedback or ideas.
          </p>
          <ContactForm />
        </div>
      </main>
    </>
  )
}
