import { Nav } from '@/components/nav'
import { db } from '@/lib/db/client'
import { characters, stages } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import Image from 'next/image'
import Link from 'next/link'

export const metadata = { title: 'Characters' }
export const revalidate = 60

async function getActiveCharacters() {
  return db
    .select({
      id: characters.id,
      name: characters.name,
      occupation: characters.occupation,
      imageUrl: characters.imageUrl,
      stageId: characters.stageId,
      isComplete: characters.isComplete,
    })
    .from(characters)
    .where(eq(characters.isComplete, true))
    .orderBy(desc(characters.createdAt))
    .limit(60)
}

export default async function CharactersPage() {
  const activeCharacters = await getActiveCharacters().catch(() => [])

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1280px] px-6 py-10">
        <div className="mb-8">
          <h1
            className="font-display text-[40px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Characters
          </h1>
          <p className="mt-2 text-sm text-[#888880]">
            {activeCharacters.length} character{activeCharacters.length !== 1 ? 's' : ''} currently
            on stage
          </p>
        </div>

        {activeCharacters.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#888880]">No characters on stage yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {activeCharacters.map((char) => (
              <Link
                key={char.id}
                href={`/stage/${char.stageId}`}
                className="group flex flex-col rounded-md border border-[#242424] bg-[#161616] overflow-hidden transition-all hover:border-[#3A3A3A] hover:shadow-[0_0_20px_rgba(196,30,58,0.08)]"
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
      </main>
    </>
  )
}
