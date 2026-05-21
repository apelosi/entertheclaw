/**
 * One-line all-red "Enter the Claw" — claw replaces C only (no separate logo icon).
 *
 * Usage: bun run wordmark:build
 */
import { writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import { OPENCLAW_LOGO_REFERENCE_PATH } from '../images/brand-references'
import { saveBufferAsPng, savePngAsWebp } from '../images/save-public-png'

const OUT_H = 140
const GAP_PX = 3
const BRAND_RED = '#C41E3A'
const FONT_SIZE = 54
/** Slightly below cap height of Enter the / law */
const CLAW_CAP_HEIGHT = 62

/** Open claw from logo ref — already opens right, C-shaped */
async function clawFromLogoReference(): Promise<Buffer> {
  return sharp(OPENCLAW_LOGO_REFERENCE_PATH)
    .extract({ left: 140, top: 42, width: 72, height: 98 })
    .resize({ height: CLAW_CAP_HEIGHT, fit: 'contain' })
    .ensureAlpha()
    .png()
    .toBuffer()
}

function textSvg(text: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" height="${OUT_H}">
  <text
    x="0"
    y="${Math.round(OUT_H * 0.82)}"
    font-family="Arial Black, Helvetica Neue, Arial, sans-serif"
    font-size="${FONT_SIZE}"
    font-weight="900"
    fill="${BRAND_RED}"
    stroke="#9B1B30"
    stroke-width="2.5"
    paint-order="stroke fill"
    letter-spacing="-0.03em"
  >${text}</text>
</svg>`
}

async function rasterizeSvg(svg: string): Promise<{ buffer: Buffer; width: number; height: number }> {
  const trimmed = await sharp(Buffer.from(svg)).png().trim().toBuffer()
  const meta = await sharp(trimmed).metadata()
  return { buffer: trimmed, width: meta.width ?? 0, height: meta.height ?? 0 }
}

async function writeWordmarkSvg(png: Buffer, width: number, height: number): Promise<void> {
  const b64 = png.toString('base64')
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image width="${width}" height="${height}" xlink:href="data:image/png;base64,${b64}"/>
</svg>`
  await writeFile(join(process.cwd(), 'public', 'logo-wordmark.svg'), svg)
  await writeFile(join(process.cwd(), 'public', 'brand', 'wordmark-composite.svg'), svg)
}

async function main() {
  console.log('Building one-line wordmark (claw-as-C + red type, no logo icon)...\n')

  const clawBuf = await clawFromLogoReference()
  const [enter, law] = await Promise.all([
    rasterizeSvg(textSvg('Enter the ')),
    rasterizeSvg(textSvg('law')),
  ])

  const clawMeta = await sharp(clawBuf).metadata()
  const clawW = clawMeta.width ?? 0
  const clawH = clawMeta.height ?? 0

  const totalW = enter.width + GAP_PX + clawW + GAP_PX + law.width
  const baseline = Math.round(OUT_H * 0.82)
  const clawLeft = enter.width + GAP_PX
  const lawLeft = clawLeft + clawW + GAP_PX

  const png = await sharp({
    create: {
      width: totalW,
      height: OUT_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: enter.buffer, left: 0, top: baseline - enter.height },
      {
        input: clawBuf,
        left: clawLeft,
        top: baseline - clawH + Math.round(clawH * 0.04),
      },
      { input: law.buffer, left: lawLeft, top: baseline - law.height },
    ])
    .png()
    .toBuffer()

  const trimmed = await sharp(png).trim().png().toBuffer()
  const scaled = await sharp(trimmed)
    .resize({ height: OUT_H, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer()
  const meta = await sharp(scaled).metadata()

  await saveBufferAsPng('logo-wordmark', scaled)
  await savePngAsWebp('logo-wordmark', scaled)
  await writeWordmarkSvg(scaled, meta.width ?? totalW, meta.height ?? OUT_H)

  console.log(`  ✓ ${meta.width}×${meta.height}px — one line, no icon`)
  console.log('  ✓ public/logo-wordmark.png, .webp, .svg')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
