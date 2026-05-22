/**
 * Copy prepared hero-stage.webp → hero-banner.webp.
 * hero-stage.webp intentionally mirrors the final banner image to avoid stale raw-stage drift.
 *
 * Usage: bun run hero:composite
 */
import { access, copyFile } from 'fs/promises'
import { constants } from 'fs'
import { join } from 'path'

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

  if (!(await fileExists(stagePath))) {
    throw new Error('Missing hero-stage.webp')
  }

  const outPath = join(publicDir, 'hero-banner.webp')
  await copyFile(stagePath, outPath)
  console.log('  ✓ Copied public/hero-stage.webp → public/hero-banner.webp')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
