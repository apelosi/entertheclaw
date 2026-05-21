/**
 * CLI: Wordmark via OpenAI/Gemini with OpenClaw wordmark reference.
 * Usage: bun run logo:generate:wordmark
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { generateBrandImage } from '../images/generate-brand-image'
import { LOGO_WORDMARK_PROMPT } from '../images/brand-prompts'
import { saveBufferAsPng, savePngAsWebp } from '../images/save-public-png'
import { whiteToAlpha } from '../images/chroma-to-alpha'

async function main() {
  console.log('Generating wordmark (OpenClaw wordmark reference)...\n')

  let buf = await generateBrandImage({
    prompt: LOGO_WORDMARK_PROMPT,
    reference: 'wordmark',
    aspectRatio: '16:9',
  })
  buf = await whiteToAlpha(buf)

  await saveBufferAsPng('logo-wordmark', buf)
  await savePngAsWebp('logo-wordmark', buf)
  console.log('  ✓ Saved: public/logo-wordmark.png, public/logo-wordmark.webp')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
