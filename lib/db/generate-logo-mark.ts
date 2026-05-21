/**
 * CLI: Logo mark via OpenAI/Gemini with OpenClaw logo reference.
 * Usage: bun run logo:generate:mark
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { generateBrandImage } from '../images/generate-brand-image'
import { LOGO_MARK_PROMPT } from '../images/brand-prompts'
import { saveBufferAsPng, savePngAsWebp } from '../images/save-public-png'
import { whiteToAlpha } from '../images/chroma-to-alpha'

async function main() {
  console.log('Generating logo mark (OpenClaw logo reference)...\n')

  let buf = await generateBrandImage({
    prompt: LOGO_MARK_PROMPT,
    reference: 'logo',
    aspectRatio: '1:1',
  })
  buf = await whiteToAlpha(buf)

  await saveBufferAsPng('logo-mark', buf)
  await savePngAsWebp('logo-mark', buf)
  console.log('  ✓ Saved: public/logo-mark.png, public/logo-mark.webp')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
