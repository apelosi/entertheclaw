/**
 * CLI script: Generate 8-bit pixel art background images for all stages.
 *
 * Usage:
 *   bun run db:generate-images          # only stages missing a local image
 *   bun run db:generate-images --force  # regenerate remote/expired images too
 *
 * Images are generated via Recraft, saved under public/stages/, and the DB
 * stores a stable path like /stages/{id}.webp.
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import * as schema from './schema'
import { generateImage } from '../images/recraft'
import { getStageBackgroundPrompt } from '../images/prompts'
import {
  isRemoteStageImageUrl,
  persistStageImageFromUrl,
  stageImageFileExists,
} from '../images/persist-stage-image'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })
const force = process.argv.includes('--force')

async function needsImage(stage: typeof schema.stages.$inferSelect): Promise<boolean> {
  if (force) return true
  if (!stage.imageUrl) return true
  if (stage.imageUrl.startsWith('/stages/')) {
    return !(await stageImageFileExists(stage.id))
  }
  if (isRemoteStageImageUrl(stage.imageUrl)) return true
  return false
}

async function main() {
  const allStages = await db.select().from(schema.stages)
  const stagesNeedingImages: typeof allStages = []

  for (const stage of allStages) {
    if (await needsImage(stage)) stagesNeedingImages.push(stage)
  }

  if (stagesNeedingImages.length === 0) {
    console.log('All stages already have local images. Nothing to do.')
    return
  }

  console.log(
    `Generating images for ${stagesNeedingImages.length} stages${force ? ' (force)' : ''}...`
  )

  for (const stage of stagesNeedingImages) {
    const prompt = getStageBackgroundPrompt(stage.theme)
    console.log(`\n[${stage.name}] theme=${stage.theme}`)

    try {
      const { url: remoteUrl } = await generateImage({
        prompt,
        style: 'Pixel art',
        size: '1820x1024',
      })
      const localPath = await persistStageImageFromUrl(stage.id, remoteUrl)
      await db
        .update(schema.stages)
        .set({ imageUrl: localPath })
        .where(eq(schema.stages.id, stage.id))
      console.log(`  ✓ Saved: ${localPath}`)
    } catch (err) {
      console.error(`  ✗ Failed:`, err instanceof Error ? err.message : err)
    }
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
