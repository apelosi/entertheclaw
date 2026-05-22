/**
 * CLI: 8-bit hero stage only (empty spotlight) via Recraft.
 * Usage: bun run hero:generate:stage
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { generateImage } from '../images/recraft'
import { saveUrlAsWebp } from '../images/save-public-webp'
import { HERO_STAGE_PROMPT } from '../images/brand-prompts'

async function main() {
  console.log('Generating hero stage via Recraft (Pixel art)...\n')

  const { url } = await generateImage({
    prompt: HERO_STAGE_PROMPT,
    style: 'Pixel art',
    size: '2048x1024',
  })
  const path = await saveUrlAsWebp('hero-stage', url)
  console.log(`  ✓ Saved: public${path}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
