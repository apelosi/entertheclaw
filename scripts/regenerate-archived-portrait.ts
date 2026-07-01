/**
 * One-off backfill: regenerate a portrait for an archived character whose
 * original characters row (and its image bytes) was deleted before the
 * archive table gained portraitBytes/spriteBytes/assetsVersion columns.
 *
 * Point this at PRODUCTION explicitly via NEON_DATABASE_URL — it is not run
 * automatically and does not touch any live (non-archived) character.
 *
 * Usage:
 *   NEON_DATABASE_URL=<prod-connection-string> bunx tsx \
 *     scripts/regenerate-archived-portrait.ts --agent-id <uuid> --name "Ryn Zephyr"
 *
 * Both --agent-id and --name must match the same archived_characters row
 * (double-checked before writing) so this can't silently hit the wrong record.
 */
import * as dotenv from 'dotenv'
if (!process.env.NEON_DATABASE_URL && !process.env.DATABASE_URL) {
  dotenv.config({ path: '.env.local' })
}

import { db } from '@/lib/db/client'
import { archivedCharacters, stages } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { generateSprite } from '@/lib/characters/generate-character-images'

function publicAssetUrl(characterId: string, version: number): string {
  return `/api/images/character/${characterId}/portrait?v=${version}`
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i !== -1 ? process.argv[i + 1] : undefined
}

async function main() {
  const agentId = argValue('--agent-id')
  const name = argValue('--name')
  if (!agentId || !name) {
    console.error('Usage: tsx scripts/regenerate-archived-portrait.ts --agent-id <uuid> --name "<exact name>"')
    process.exit(1)
  }

  const [row] = await db
    .select({
      id: archivedCharacters.id,
      originalCharacterId: archivedCharacters.originalCharacterId,
      characterData: archivedCharacters.characterData,
      assetsVersion: archivedCharacters.assetsVersion,
      stageId: archivedCharacters.stageId,
    })
    .from(archivedCharacters)
    .where(
      and(
        eq(archivedCharacters.agentId, agentId),
        sql`${archivedCharacters.characterData}->>'name' = ${name}`,
      ),
    )
    .limit(1)

  if (!row) {
    console.error(`No archived_characters row found for agentId=${agentId} name="${name}"`)
    process.exit(1)
  }
  if (!row.originalCharacterId) {
    console.error(`Row ${row.id} has no originalCharacterId — cannot build a servable image URL for it.`)
    process.exit(1)
  }

  const data = row.characterData as {
    name: string
    occupation: string | null
    appearance: string | null
  }
  console.log(`Found: id=${row.id} originalCharacterId=${row.originalCharacterId} name="${data.name}"`)

  const [stage] = await db
    .select({ name: stages.name, theme: stages.theme })
    .from(stages)
    .where(eq(stages.id, row.stageId))
    .limit(1)
  if (!stage) {
    console.error(`Stage ${row.stageId} not found.`)
    process.exit(1)
  }

  console.log(`Generating portrait via Recraft: "${data.name}", ${data.occupation ?? 'unknown occupation'}, on "${stage.name}" (${stage.theme})...`)
  const imageBytes = await generateSprite({
    characterName: data.name,
    appearance: data.appearance ?? `${data.occupation ?? 'a character'} of mysterious appearance`,
    occupation: data.occupation ?? 'wanderer',
    stageName: stage.name,
    stageTheme: stage.theme,
  })

  const nextVersion = (row.assetsVersion ?? 0) + 1
  await db
    .update(archivedCharacters)
    .set({ portraitBytes: imageBytes, assetsVersion: nextVersion })
    .where(eq(archivedCharacters.id, row.id))

  console.log(`Done. Portrait bytes written (${imageBytes.length} bytes), assetsVersion=${nextVersion}.`)
  console.log(`Servable at: ${publicAssetUrl(row.originalCharacterId, nextVersion)} (the existing characterData.imageUrl already points here — no snapshot update needed).`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
