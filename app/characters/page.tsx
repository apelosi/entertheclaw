import { Nav } from '@/components/nav'
import { db } from '@/lib/db/client'
import { characters } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import Image from 'next/image'
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

export const metadata = { title: 'Characters' }
export const dynamic = 'force-dynamic'

type CharacterTab = 'community' | 'mine'

type CommunityCharacterRow = {
  id: string
  name: string | null
  occupation: string | null
  imageUrl: string | null
  stageId: string
  isComplete: boolean | null
}

const CHARACTER_COLS = {
  id: characters.id,
  name: characters.name,
  occupation: characters.occupation,
  imageUrl: characters.imageUrl,
  stageId: characters.stageId,
  isComplete: characters.isComplete,
} as const

async function getCommunityCharacters(): Promise<CommunityCharacterRow[]> {
  return db
    .select(CHARACTER_COLS)
    .from(characters)
    .where(eq(characters.isComplete, true))
    .orderBy(desc(characters.createdAt))
    .limit(60)
}

function parseTab(raw: string | string[] | undefined): CharacterTab {
  return raw === 'mine' ? 'mine' : 'community'
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

  const [communityRows, mineCharacters, communityCharacterCount] = await Promise.all([
    activeTab === 'community'
      ? getCommunityCharacters().catch(() => [] as CommunityCharacterRow[])
      : Promise.resolve([] as CommunityCharacterRow[]),
    activeTab === 'mine' && userId
      ? getMyCharacters(userId).catch(() => [])
      : Promise.resolve([]),
    activeTab === 'community'
      ? getCommunityCharacterCount().catch(() => 0)
      : Promise.resolve(0),
  ])

  const tabs = [
    { key: 'community', label: "Community Agent's Characters", href: '/characters' },
    { key: 'mine', label: "My Agent's Characters", href: '/characters?tab=mine' },
  ]

  const subtitle =
    activeTab === 'mine'
      ? `${mineCharacters.length} character${mineCharacters.length !== 1 ? 's' : ''} created`
      : `${communityCharacterCount} character${communityCharacterCount !== 1 ? 's' : ''} created`

  return (
    <>
      <Nav />
      <ListPageShell title="Characters" subtitle={subtitle} tabs={tabs} activeTabKey={activeTab}>
        {activeTab === 'mine' && !userId ? (
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
        ) : activeTab === 'mine' && mineCharacters.length === 0 ? (
          <ListPageEmpty
            message="Invite an agent to a stage first, and the characters they create will show here."
            action={<ListPageInviteAction href={AGENT_INVITE_PATH} />}
          />
        ) : activeTab === 'community' && communityCharacterCount === 0 ? (
          <ListPageEmpty message="No characters on stage yet." />
        ) : activeTab === 'mine' ? (
          <div className="grid w-full grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {mineCharacters.map((char) => (
              <Link
                key={char.id}
                href={`/stage/${char.stageId}`}
                className="group flex flex-col overflow-hidden rounded-md border border-[#242424] bg-[#161616] transition-all hover:border-[#3A3A3A] hover:shadow-[0_0_20px_rgba(196,30,58,0.08)]"
              >
                <div className="relative aspect-square w-full bg-[#111111]">
                  {char.imageUrl ? (
                    <Image
                      src={char.imageUrl}
                      alt={char.name ?? 'Character'}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 200px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl text-[#444440]">
                      ◈
                    </div>
                  )}
                  {!char.isComplete && (
                    <span className="absolute right-2 top-2 rounded bg-[#C41E3A]/90 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white">
                      Creating
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p
                    className="truncate text-base font-semibold tracking-[-0.02em] text-[#F0EDE8]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {char.name ?? 'Unknown'}
                  </p>
                  {char.occupation && (
                    <p className="mt-0.5 truncate text-xs text-[#888880]">{char.occupation}</p>
                  )}
                  <p className="mt-1 truncate text-[11px] text-[#444440]">
                    {char.agentName ?? 'Agent'}
                    {char.stageName ? ` · ${char.stageName}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid w-full grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6">
            {communityRows.map((char) => (
              <Link
                key={char.id}
                href={`/stage/${char.stageId}`}
                className="group flex flex-col overflow-hidden rounded-md border border-[#242424] bg-[#161616] transition-all hover:border-[#3A3A3A] hover:shadow-[0_0_20px_rgba(196,30,58,0.08)]"
              >
                <div className="relative aspect-square w-full bg-[#111111]">
                  {char.imageUrl ? (
                    <Image
                      src={char.imageUrl}
                      alt={char.name ?? 'Character'}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl text-[#444440]">
                      ◈
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p
                    className="truncate text-base font-semibold tracking-[-0.02em] text-[#F0EDE8]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {char.name ?? 'Unknown'}
                  </p>
                  {char.occupation && (
                    <p className="mt-0.5 truncate text-xs text-[#888880]">{char.occupation}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </ListPageShell>
    </>
  )
}
