/**
 * Horizontal all-red "Enter the Claw" — mascot claw-C + chunky type.
 *
 * Usage: bun run wordmark:build
 * With AI claw-C: USE_AI_CLAW_C=1 bun run wordmark:build
 */
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { access, constants } from 'fs/promises'
import sharp from 'sharp'
import { saveBufferAsPng, savePngAsWebp } from '../images/save-public-png'

const HERO_AGENT = join(process.cwd(), 'public', 'hero-agent.png')
const CLAW_C_AI = join(process.cwd(), 'public', 'brand', 'claw-letter-c.png')
const OUT_H = 168
const GAP_PX = 4
const BRAND_RED = '#C41E3A'
const FONT_SIZE = 78
const CLAW_CAP_HEIGHT = 84

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/** Raised soliloquy claw from hero-agent — same character as homepage */
async function clawFromHeroAgent(): Promise<Buffer> {
  let buf = await sharp(HERO_AGENT)
    .extract({ left: 524, top: 12, width: 428, height: 388 })
    .rotate(-38, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ height: CLAW_CAP_HEIGHT + 8, fit: 'contain' })
    .ensureAlpha()
    .png()
    .toBuffer()

  buf = await sharp(buf).median(1).png().toBuffer()
  return sharp(buf).trim().resize({ height: CLAW_CAP_HEIGHT, fit: 'contain' }).png().toBuffer()
}

async function prepareClawC(): Promise<Buffer> {
  if (process.env.USE_AI_CLAW_C === '1' && (await fileExists(CLAW_C_AI))) {
    return sharp(CLAW_C_AI)
      .resize({ height: CLAW_CAP_HEIGHT, fit: 'contain' })
      .ensureAlpha()
      .trim()
      .png()
      .toBuffer()
  }
  if (await fileExists(HERO_AGENT)) {
    return clawFromHeroAgent()
  }
  throw new Error('Missing public/hero-agent.png — run: bun run hero:generate:agent')
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
    stroke-width="3"
    paint-order="stroke fill"
    letter-spacing="-0.04em"
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
  console.log('Building wordmark (mascot claw-C + all-red type)...\n')

  const clawBuf = await prepareClawC()
  const [enter, law] = await Promise.all([
    rasterizeSvg(textSvg('Enter the ')),
    rasterizeSvg(textSvg('law')),
  ])

  const clawMeta = await sharp(clawBuf).metadata()
  const clawW = clawMeta.width ?? 0
  const clawH = clawMeta.height ?? 0

  const totalW = enter.width + GAP_PX + clawW + GAP_PX + law.width
  const baseline = Math.round(OUT_H * 0.82)
  const enterTop = baseline - enter.height
  const lawTop = baseline - law.height
  const clawTop = baseline - clawH + Math.round(clawH * 0.05)
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
      { input: enter.buffer, left: 0, top: Math.max(0, enterTop) },
      { input: clawBuf, left: clawLeft, top: Math.max(0, clawTop) },
      { input: law.buffer, left: lawLeft, top: Math.max(0, lawTop) },
    ])
    .png()
    .toBuffer()

  const trimmed = await sharp(png).trim().png().toBuffer()
  const scaled = await sharp(trimmed)
    .resize({ width: 920, withoutEnlargement: false })
    .png()
    .toBuffer()
  const meta = await sharp(scaled).metadata()

  await saveBufferAsPng('logo-wordmark', scaled)
  await savePngAsWebp('logo-wordmark', scaled)
  await writeWordmarkSvg(scaled, meta.width ?? totalW, meta.height ?? OUT_H)

  console.log(`  ✓ ${meta.width}×${meta.height}px (type ${FONT_SIZE}px, claw ${CLAW_CAP_HEIGHT}px)`)
  console.log('  ✓ public/logo-wordmark.png, .webp, .svg')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
