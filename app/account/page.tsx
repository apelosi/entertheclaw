import { getServerSession } from '@/lib/auth/get-server-session'
import { needsDisplayName } from '@/lib/auth/display-name'
import { syncUserDisplayName } from '@/lib/users/public-profile'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { Nav } from '@/components/nav'
import { ConnectedProviders } from '@/components/account/connected-providers'
import { DisplayNameForm } from '@/components/account/display-name-form'
import { PasswordForm } from '@/components/account/password-form'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Account' }

export default async function AccountPage() {
  const { data: session } = await getServerSession()
  if (!session?.user) redirect('/auth')
  const user = session.user

  if (!needsDisplayName(user)) {
    const label = user.name?.trim() || user.email?.split('@')[0]
    if (label) await syncUserDisplayName(user.id, label)
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[640px] px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="font-display text-[32px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Account
            </h1>
            <p className="mt-1 text-sm text-[#888880]">Profile and sign-in methods</p>
          </div>
          <SignOutButton />
        </div>

        <section className="mb-8 rounded-md border border-[#242424] bg-[#161616] p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
            Profile
          </h2>
          <dl className="space-y-4">
            <div>
              <DisplayNameForm
                initialName={user.name?.trim() ?? ''}
                mode="account"
              />
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-[#444440]">
                Email
                <InfoTooltip label="Email cannot be changed yet." />
              </dt>
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
            </div>
          </dl>
        </section>

        <section className="mb-8 rounded-md border border-[#242424] bg-[#161616] p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
            Password
          </h2>
          <PasswordForm />
        </section>

        <section className="mb-8 rounded-md border border-[#242424] bg-[#161616] p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
            Sign-in methods
          </h2>
          <ConnectedProviders />
        </section>

      </main>
    </>
  )
}
