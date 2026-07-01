import { db } from '@/lib/db/client'
import { archivedCharacters, characters } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

const VALID_KINDS = new Set(['portrait', 'sprite'])

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> }
) {
  try {
    const { id, kind } = await params
    if (!VALID_KINDS.has(kind)) {
      return new Response('Bad kind', { status: 400 })
    }

    let row: { portrait: Buffer | null; sprite: Buffer | null; version: number | null } | undefined =
      await db
        .select({
          portrait: characters.portraitBytes,
          sprite: characters.spriteBytes,
          version: characters.assetsVersion,
        })
        .from(characters)
        .where(eq(characters.id, id))
        .limit(1)
        .then((rows) => rows[0])

    // Character may have been archived (pulled/timed out from a stage) since
    // this URL was generated — the live row is gone but the archive keeps a
    // copy of the bytes precisely so this doesn't 404 forever.
    if (!row) {
      row = await db
        .select({
          portrait: archivedCharacters.portraitBytes,
          sprite: archivedCharacters.spriteBytes,
          version: archivedCharacters.assetsVersion,
        })
        .from(archivedCharacters)
        .where(eq(archivedCharacters.originalCharacterId, id))
        .limit(1)
        .then((rows) => rows[0])
    }

    if (!row) {
      return new Response('Not found', { status: 404 })
    }

    const buf = kind === 'portrait' ? row.portrait : row.sprite
    if (!buf || buf.length === 0) {
      return new Response('Asset not ready', { status: 404 })
    }

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        // URLs are content-addressed via ?v={assetsVersion}, so we can cache forever.
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: `"${id}-${kind}-${row.version}"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/images/character/:id/:kind]', err)
    return new Response('Internal error', { status: 500 })
  }
}
