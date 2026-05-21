/**
 * Generate claw-as-letter-C from hero-agent (same claw as homepage character).
 * Usage: bun run logo:generate:claw-c
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import { generateOpenAIImage } from '../images/openai-image'
import { CLAW_LETTER_C_PROMPT } from '../images/brand-prompts'
import { whiteToAlpha } from '../images/chroma-to-alpha'

const HERO_AGENT = join(process.cwd(), 'public', 'hero-agent.png')
const OUT = join(process.cwd(), 'public', 'brand', 'claw-letter-c.png')

async function main() {
  console.log('Generating claw letter C (hero-agent reference)...\n')

  let buf = await generateOpenAIImage({
    prompt: CLAW_LETTER_C_PROMPT,
    referencePath: HERO_AGENT,
    size: '1024x1024',
  })
  buf = await whiteToAlpha(buf)
  buf = await sharp(buf).trim().png().toBuffer()

  await writeFile(OUT, buf)
  const meta = await sharp(buf).metadata()
  console.log(`  ✓ Saved: public/brand/claw-letter-c.png (${meta.width}×${meta.height})`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
