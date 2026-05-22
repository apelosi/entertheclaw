/**
 * CLI: Hero character via OpenAI/Gemini with OpenClaw logo reference.
 * Usage: bun run hero:generate:agent
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { generateBrandImage } from '../images/generate-brand-image'
import { HERO_AGENT_PROMPT } from '../images/brand-prompts'
import sharp from 'sharp'
import { saveBufferAsPng } from '../images/save-public-png'
import { whiteToAlpha } from '../images/chroma-to-alpha'

async function main() {
  console.log('Generating hero agent (OpenClaw logo reference)...\n')

  let buf = await generateBrandImage({
    prompt: HERO_AGENT_PROMPT,
    reference: 'logo',
    aspectRatio: '1:1',
  })
  buf = await whiteToAlpha(buf)
  buf = await sharp(buf).trim({ threshold: 10 }).png().toBuffer()

  await saveBufferAsPng('hero-agent', buf)
  console.log('  ✓ Saved: public/hero-agent.png')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
