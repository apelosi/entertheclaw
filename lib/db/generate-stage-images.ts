/**
 * CLI script: Generate 8-bit pixel art background images for all stages.
 *
 * Usage:
 *   bun run db:generate-images
 *
 * Skips stages that already have an imageUrl (idempotent).
 * Images are generated via the Recraft API and URLs stored in the DB.
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import * as schema from './schema'
import { generateImage } from '../images/recraft'
import { getStageBackgroundPrompt } from '../images/prompts'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

async function main() {
  const allStages = await db.select().from(schema.stages)

  const stagesNeedingImages = allStages.filter((s) => !s.imageUrl)

  if (stagesNeedingImages.length === 0) {
    console.log('All stages already have images. Nothing to do.')
    return
  }

  console.log(`Generating images for ${stagesNeedingImages.length} stages...`)

  for (const stage of stagesNeedingImages) {
    const prompt = getStageBackgroundPrompt(stage.theme)
    console.log(`\n[${stage.name}] theme=${stage.theme}`)
    console.log(`  Prompt: ${prompt.slice(0, 80)}...`)

    try {
      const { url } = await generateImage({ prompt, style: 'Pixel art', size: '1820x1024' })
      await db.update(schema.stages).set({ imageUrl: url }).where(eq(schema.stages.id, stage.id))
      console.log(`  ✓ Saved: ${url.slice(0, 60)}...`)
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
