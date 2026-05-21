/**
 * Build "Enter the Claw" wordmark: "Enter the " + open claw as C + "law"
 * Uses claw crop from OpenClaw logo reference (no separate mascot icon).
 *
 * Usage: bun run wordmark:build
 */
import { writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import { OPENCLAW_LOGO_REFERENCE_PATH } from '../images/brand-references'
import { saveBufferAsPng, savePngAsWebp } from '../images/save-public-png'

const OUT_W = 1600
const OUT_H = 280

async function extractClawMark(): Promise<Buffer> {
  // Open pincer only (right claw from logo reference) — used as letter C
  return sharp(OPENCLAW_LOGO_REFERENCE_PATH)
    .extract({ left: 132, top: 18, width: 102, height: 128 })
    .png()
    .toBuffer()
}

function buildWordmarkSvg(clawB64: string, clawW: number, clawH: number): string {
  const textY = 200
  const fontSize = 118
  const enterW = 548
  const clawX = enterW + 18
  const lawX = clawX + clawW + 10

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${OUT_W}" height="${OUT_H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="transparent"/>
  <text x="0" y="${textY}" font-family="Arial Black, Helvetica Neue, sans-serif" font-size="${fontSize}" font-weight="900" fill="#F0EDE8" letter-spacing="-2">Enter the </text>
  <image href="data:image/png;base64,${clawB64}" x="${clawX}" y="${Math.round((OUT_H - clawH) / 2) - 10}" width="${clawW}" height="${clawH}"/>
  <text x="${lawX}" y="${textY}" font-family="Arial Black, Helvetica Neue, sans-serif" font-size="${fontSize}" font-weight="900" fill="#F0EDE8" letter-spacing="-2">law</text>
</svg>`
}

async function main() {
  console.log('Building wordmark from logo claw crop + typography...\n')

  const clawBuf = await extractClawMark()
  const clawMeta = await sharp(clawBuf).metadata()
  const clawW = clawMeta.width ?? 118
  const clawH = clawMeta.height ?? 175

  const clawScaledH = 170
  const clawScaledW = Math.round((clawW / clawH) * clawScaledH)

  const clawScaled = await sharp(clawBuf)
    .resize(clawScaledW, clawScaledH, { fit: 'contain' })
    .png()
    .toBuffer()

  const clawB64 = clawScaled.toString('base64')
  const svg = buildWordmarkSvg(clawB64, clawScaledW, clawScaledH)

  const svgPath = join(process.cwd(), 'public', 'brand', 'wordmark-composite.svg')
  await writeFile(svgPath, svg)

  let png = await sharp(Buffer.from(svg)).png().toBuffer()
  png = await sharp(png).trim().toBuffer()

  await saveBufferAsPng('logo-wordmark', png)
  await savePngAsWebp('logo-wordmark', png)
  console.log('  ✓ Saved: public/logo-wordmark.png, public/logo-wordmark.webp')
  console.log('  ✓ SVG source: public/brand/wordmark-composite.svg')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
