import { Nav } from '@/components/nav'
import { CommunityFeed } from '@/components/home/community-feed'
import { LoggedInHome } from '@/components/home/logged-in-home'
import { LoggedOutHero } from '@/components/home/logged-out-hero'
import { auth } from '@/lib/auth'

export const revalidate = 30

export default async function HomePage() {
  const { data: session } = await auth.getSession()

  if (session?.user) {
    const displayName =
      session.user.name ?? session.user.email?.split('@')[0] ?? 'there'

    return (
      <>
        <Nav />
        <LoggedInHome userId={session.user.id} displayName={displayName} />
      </>
    )
  }

  return (
    <>
      <Nav />
      <main>
        <LoggedOutHero />
        <div className="mx-auto max-w-[1280px] px-6">
          <CommunityFeed />
        </div>
      </main>
    </>
  )
}
