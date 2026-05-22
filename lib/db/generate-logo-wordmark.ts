/**
 * CLI: "Enter the Claw" wordmark via OpenAI + OpenClaw wordmark reference.
 *
 * Usage: bun run logo:generate:wordmark
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import { generateBrandImage } from '../images/generate-brand-image'
import { LOGO_WORDMARK_PROMPT } from '../images/brand-prompts'
import { saveBufferAsPng, savePngAsWebp } from '../images/save-public-png'
import { whiteToAlpha } from '../images/chroma-to-alpha'

async function writeWordmarkSvg(png: Buffer, width: number, height: number): Promise<void> {
  const b64 = png.toString('base64')
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image width="${width}" height="${height}" xlink:href="data:image/png;base64,${b64}"/>
</svg>`
  await writeFile(join(process.cwd(), 'public', 'logo-wordmark.svg'), svg)
}

async function main() {
  console.log('Generating wordmark (wordmark reference → Enter the Claw)...\n')

  let buf = await generateBrandImage({
    prompt: LOGO_WORDMARK_PROMPT,
    reference: 'wordmark',
    aspectRatio: '16:9',
  })
  buf = await whiteToAlpha(buf)
  buf = await sharp(buf).trim().png().toBuffer()

  const meta = await sharp(buf).metadata()
  const width = meta.width ?? 1
  const height = meta.height ?? 1

  await saveBufferAsPng('logo-wordmark', buf)
  await savePngAsWebp('logo-wordmark', buf)
  await writeWordmarkSvg(buf, width, height)

  console.log(`  ✓ ${width}×${height}px`)
  console.log('  ✓ public/logo-wordmark.png, .webp, .svg')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
