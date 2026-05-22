/**
 * Hero character as 8-bit pixel art (matches hero stage style).
 * Usage: bun run hero:generate:agent:pixel
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import sharp from 'sharp'
import { generateImage } from '../images/recraft'
import { HERO_AGENT_PIXEL_PROMPT } from '../images/brand-prompts'
import { saveBufferAsPng } from '../images/save-public-png'
import { whiteToAlpha } from '../images/chroma-to-alpha'

async function main() {
  console.log('Generating hero agent (Recraft Pixel art)...\n')

  const { url } = await generateImage({
    prompt: HERO_AGENT_PIXEL_PROMPT,
    style: 'Pixel art',
    size: '1024x1024',
  })

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download Recraft image: ${res.status}`)
  let buf: Buffer = Buffer.from(await res.arrayBuffer())
  buf = (await whiteToAlpha(buf)) as Buffer
  buf = await sharp(buf).trim({ threshold: 24 }).png().toBuffer()

  await saveBufferAsPng('hero-agent', buf)
  console.log('  ✓ Saved: public/hero-agent.png')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
