import { getServerSession } from '@/lib/auth/get-server-session'
import { displayNameOnboardingPath } from '@/lib/auth/display-name'
import { userNeedsDisplayName } from '@/lib/users/public-profile'
import { authUrl } from '@/lib/auth/paths'
import { DisplayNameForm } from '@/components/account/display-name-form'
import { HOME_PATH } from '@/lib/paths'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Set display name' }

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function DisplayNameOnboardingPage({ searchParams }: PageProps) {
  const { callbackUrl: rawCallback } = await searchParams
  const callbackUrl =
    rawCallback?.startsWith('/') && !rawCallback.startsWith('//') ? rawCallback : HOME_PATH

  const { data: session } = await getServerSession()
  if (!session?.user) {
    redirect(authUrl(displayNameOnboardingPath(callbackUrl)))
  }

  if (!(await userNeedsDisplayName(session.user.id))) {
    redirect(callbackUrl)
  }

  // Default to the email handle (everything before the @) regardless of how
  // the user signed up, falling back to any Neon Auth name only if there is
  // no email on the account.
  const suggested =
    session.user.email?.split('@')[0]?.trim() ||
    session.user.name?.trim() ||
    ''

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080808] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/">
            <h1
              className="font-display text-[32px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Enter The Claw
            </h1>
          </Link>
          <p className="mt-2 text-sm text-[#888880]">Choose how you appear on the site</p>
        </div>

        <DisplayNameForm
          initialName={suggested}
          mode="onboarding"
          callbackUrl={callbackUrl}
        />
      </div>
    </div>
  )
}
