/**
 * Composite hero-agent.png (alpha) onto hero-stage.webp → hero-banner.webp
 *
 * Usage: bun run hero:composite
 */
import { access, rename } from 'fs/promises'
import { constants } from 'fs'
import { join } from 'path'
import sharp from 'sharp'

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function main() {
  const publicDir = join(process.cwd(), 'public')
  const stagePath = join(publicDir, 'hero-stage.webp')
  const agentPath = join(publicDir, 'hero-agent.png')

  let bannerInput = stagePath
  if (!(await fileExists(stagePath))) {
    const fallback = join(publicDir, 'hero-banner.webp')
    if (await fileExists(fallback)) {
      console.warn('  hero-stage.webp missing; using hero-banner.webp as stage base')
      bannerInput = fallback
    } else {
      throw new Error('Missing hero-stage.webp — run: bun run hero:generate:stage')
    }
  }

  if (!(await fileExists(agentPath))) {
    throw new Error('Missing hero-agent.png — run: bun run hero:generate:agent')
  }

  const banner = sharp(bannerInput)
  const meta = await banner.metadata()
  const width = meta.width ?? 2048
  const height = meta.height ?? 1024

  const agentSize = Math.round(height * 0.52)
  const agent = await sharp(agentPath)
    .resize(agentSize, agentSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  // Center in spotlight pool (stage right of text overlay)
  const left = Math.round(width * 0.54 - agentSize / 2)
  const top = Math.round(height * 0.28)

  const outPath = join(publicDir, 'hero-banner.webp')
  const tmpPath = join(publicDir, 'hero-banner.tmp.webp')

  await banner
    .composite([{ input: agent, left, top }])
    .webp({ quality: 90 })
    .toFile(tmpPath)

  await rename(tmpPath, outPath)
  console.log('  ✓ Composited hero-agent.png onto stage → public/hero-banner.webp')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
