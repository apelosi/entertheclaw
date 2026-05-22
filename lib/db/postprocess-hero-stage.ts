/**
 * Neutralize green/yellow Recraft spotlight tint → warm off-white.
 * Usage: bun run hero:postprocess:stage
 */
import sharp from 'sharp'
import { join } from 'path'

const path = join(process.cwd(), 'public', 'hero-stage.webp')

async function main() {
  const img = sharp(path)
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const greenCast = g > r + 12 && g > b + 8
    const brightSpot = lum > 120

    if (greenCast || (brightSpot && g > r)) {
      const warm = Math.min(255, lum * 1.02 + 8)
      data[i] = warm
      data[i + 1] = Math.min(255, warm * 0.97)
      data[i + 2] = Math.min(255, warm * 0.92)
    }
  }

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .webp({ quality: 90 })
    .toFile(path)

  console.log('  ✓ Warm white spotlight (green removed) → public/hero-stage.webp')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
