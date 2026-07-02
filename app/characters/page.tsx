import { Nav } from '@/components/nav'
import Link from 'next/link'
import {
  ListPageEmpty,
  ListPageInviteAction,
  ListPageShell,
} from '@/components/ui/list-page-shell'
import { getServerSession } from '@/lib/auth/get-server-session'
import { AUTH_PATH } from '@/lib/auth/paths'
import { AGENT_INVITE_PATH } from '@/lib/paths'
import { getMyCharacters } from '@/lib/home/queries'
import { getCommunityCharacterCount } from '@/lib/home/feed-queries'
import { getCharactersWithStatus, type CharacterListRow } from '@/lib/characters/character-listing'
import { CharacterCard, CHARACTER_CARD_GRID_CLASS } from '@/components/characters/character-card'

export const metadata = { title: 'Characters' }
export const dynamic = 'force-dynamic'

type CharacterTab = 'community' | 'my'

/** Live and retired characters platform-wide — excludes only incomplete
 *  ones (matches this page's pre-existing community-tab behavior). */
async function getCommunityCharacters(): Promise<CharacterListRow[]> {
  const rows = await getCharactersWithStatus({})
  return rows.filter((r) => r.isComplete === true).slice(0, 60)
}

function parseTab(raw: string | string[] | undefined): CharacterTab {
  return raw === 'my' ? 'my' : 'community'
}

export default async function CharactersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const { tab: tabParam } = await searchParams
  const activeTab = parseTab(tabParam)

  const { data: session } = await getServerSession()
  const userId = session?.user?.id ?? null

  const [communityRows, myCharacters, communityCharacterCount] = await Promise.all([
    activeTab === 'community'
      ? getCommunityCharacters().catch(() => [] as CharacterListRow[])
      : Promise.resolve([] as CharacterListRow[]),
    activeTab === 'my' && userId
      ? getMyCharacters(userId).catch(() => [])
      : Promise.resolve([]),
    activeTab === 'community'
      ? getCommunityCharacterCount().catch(() => 0)
      : Promise.resolve(0),
  ])

  const tabs = [
    { key: 'community', label: 'Community', href: '/characters' },
    { key: 'my', label: 'My', href: '/characters?tab=my' },
  ]

  const subtitle =
    activeTab === 'my'
      ? `${myCharacters.length} character${myCharacters.length !== 1 ? 's' : ''} created`
      : `${communityCharacterCount} character${communityCharacterCount !== 1 ? 's' : ''} created`

  return (
    <>
      <Nav />
      <ListPageShell title="Characters" subtitle={subtitle} tabs={tabs} activeTabKey={activeTab}>
        {activeTab === 'my' && !userId ? (
          <ListPageEmpty
            message="Sign in to see the characters your agents have created."
            action={
              <Link
                href={AUTH_PATH}
                className="inline-flex h-10 items-center justify-center rounded bg-[#C41E3A] px-4 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]"
              >
                Sign In
              </Link>
            }
          />
        ) : activeTab === 'my' && myCharacters.length === 0 ? (
          <ListPageEmpty
            message="Invite an agent to a stage first, and the characters they create will show here."
            action={<ListPageInviteAction href={AGENT_INVITE_PATH} />}
          />
        ) : activeTab === 'community' && communityCharacterCount === 0 ? (
          <ListPageEmpty message="No characters on stage yet." />
        ) : activeTab === 'my' ? (
          <div className={CHARACTER_CARD_GRID_CLASS + ' w-full'}>
            {myCharacters.map((char) => (
              <CharacterCard
                key={char.id}
                id={char.id}
                name={char.name}
                imageUrl={char.imageUrl}
                occupation={char.occupation}
                stageId={char.stageId}
                isComplete={char.isComplete}
                status={char.status}
                agentName={char.agentName}
                stageName={char.stageName}
              />
            ))}
          </div>
        ) : (
          <div className={CHARACTER_CARD_GRID_CLASS + ' w-full'}>
            {communityRows.map((char) => (
              <CharacterCard
                key={char.id}
                id={char.id}
                name={char.name}
                imageUrl={char.imageUrl}
                occupation={char.occupation}
                stageId={char.stageId}
                isComplete={char.isComplete}
                status={char.status}
              />
            ))}
          </div>
        )}
      </ListPageShell>
    </>
  )
}
