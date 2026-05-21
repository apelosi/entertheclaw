/**
 * Composite hero-agent.png onto hero-stage.webp → hero-banner.webp
 * Adds a warm floor spotlight pool (Recraft stages often lack a clear pool).
 *
 * Usage: bun run hero:composite
 */
import { access, rename } from 'fs/promises'
import { constants } from 'fs'
import { join } from 'path'
import sharp from 'sharp'

const SPOTLIGHT_X = 0.58
const SPOTLIGHT_Y = 0.68

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function spotlightOverlay(width: number, height: number): Buffer {
  const cx = Math.round(width * SPOTLIGHT_X)
  const cy = Math.round(height * SPOTLIGHT_Y)
  const r = Math.round(width * 0.14)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <radialGradient id="pool" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFF9F0" stop-opacity="0.45"/>
      <stop offset="45%" stop-color="#FFF4E8" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#FFF4E8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#pool)"/>
</svg>`
  return Buffer.from(svg)
}

async function main() {
  const publicDir = join(process.cwd(), 'public')
  const stagePath = join(publicDir, 'hero-stage.webp')
  const agentPath = join(publicDir, 'hero-agent.png')

  if (!(await fileExists(stagePath))) {
    throw new Error('Missing hero-stage.webp — run: bun run hero:from-stage')
  }
  if (!(await fileExists(agentPath))) {
    throw new Error('Missing hero-agent.png — run: bun run hero:generate:agent')
  }

  const meta = await sharp(stagePath).metadata()
  const width = meta.width ?? 2048
  const height = meta.height ?? 1024

  const spotlight = await sharp(spotlightOverlay(width, height)).png().toBuffer()

  const agentSize = Math.round(height * 0.52)
  const pixelGrid = Math.max(128, Math.round(agentSize / 3.5))
  const agent = await sharp(agentPath)
    .ensureAlpha()
    .resize(pixelGrid, pixelGrid, {
      fit: 'contain',
      kernel: sharp.kernel.nearest,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(agentSize, agentSize, {
      kernel: sharp.kernel.nearest,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const left = Math.round(width * SPOTLIGHT_X - agentSize / 2)
  const top = Math.round(height * 0.22)

  const outPath = join(publicDir, 'hero-banner.webp')
  const tmpPath = join(publicDir, 'hero-banner.tmp.webp')

  await sharp(stagePath)
    .composite([
      { input: spotlight, blend: 'screen' },
      { input: agent, left, top },
    ])
    .webp({ quality: 90 })
    .toFile(tmpPath)

  await rename(tmpPath, outPath)
  console.log('  ✓ Stage + spotlight pool + agent → public/hero-banner.webp')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
