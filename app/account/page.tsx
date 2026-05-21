import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Nav } from '@/components/nav'
import { ConnectedProviders } from '@/components/account/connected-providers'
import { SignOutButton } from '@/components/auth/sign-out-button'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Account' }

export default async function AccountPage() {
  const { data: session } = await auth.getSession()
  if (!session?.user) redirect('/auth')
  const user = session.user

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[640px] px-6 py-10">
        <div className="mb-8">
          <h1
            className="font-display text-[32px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Account
          </h1>
          <p className="mt-1 text-sm text-[#888880]">Profile and sign-in methods</p>
        </div>

        <section className="mb-8 rounded-md border border-[#242424] bg-[#161616] p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
            Profile
          </h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs text-[#444440]">Display name</dt>
              <dd className="mt-1 text-sm text-[#F0EDE8]">{user.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#444440]">Email</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#F0EDE8]">
                {user.email ?? '—'}
                {user.emailVerified ? (
                  <span className="rounded bg-[#C41E3A]/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#C41E3A]">
                    Verified
                  </span>
                ) : (
                  <span className="rounded border border-[#3A3A3A] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#888880]">
                    Unverified
                  </span>
                )}
              </dd>
              <p className="mt-1 text-xs text-[#444440]">Email cannot be changed yet.</p>
            </div>
          </dl>
        </section>

        <section className="mb-8 rounded-md border border-[#242424] bg-[#161616] p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
            Sign-in methods
          </h2>
          <ConnectedProviders />
        </section>

        <section className="flex justify-end border-t border-[#1a1a1a] pt-6">
          <SignOutButton />
        </section>
      </main>
    </>
  )
}
