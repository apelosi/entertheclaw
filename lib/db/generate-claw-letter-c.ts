/**
 * Generate claw-as-letter-C from OpenClaw logo reference (claw only, no body).
 * Usage: bun run logo:generate:claw-c
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import { generateBrandImage } from '../images/generate-brand-image'
import { CLAW_LETTER_C_PROMPT } from '../images/brand-prompts'
import { whiteToAlpha } from '../images/chroma-to-alpha'

const OUT = join(process.cwd(), 'public', 'brand', 'claw-letter-c.png')

async function main() {
  console.log('Generating claw letter C (logo reference)...\n')

  let buf = await generateBrandImage({
    prompt: CLAW_LETTER_C_PROMPT,
    reference: 'logo',
    aspectRatio: '1:1',
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
