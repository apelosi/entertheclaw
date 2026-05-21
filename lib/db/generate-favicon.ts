/**
 * CLI script: Derive favicon PNGs from public/logo-mark.webp
 *
 * Usage:
 *   bun run favicon:generate
 *
 * Writes to:
 *   app/icon.png (32x32)
 *   app/apple-icon.png (180x180)
 */
import { join } from 'path'
import sharp from 'sharp'

async function main() {
  const publicDir = join(process.cwd(), 'public')
  const pngPath = join(publicDir, 'logo-mark.png')
  const webpPath = join(publicDir, 'logo-mark.webp')
  const { access } = await import('fs/promises')
  const { constants } = await import('fs')
  let src = pngPath
  try {
    await access(pngPath, constants.F_OK)
  } catch {
    src = webpPath
  }

  await sharp(src).resize(32, 32).png().toFile(join(process.cwd(), 'app', 'icon.png'))
  console.log('  ✓ Saved: app/icon.png (32×32)')

  await sharp(src).resize(180, 180).png().toFile(join(process.cwd(), 'app', 'apple-icon.png'))
  console.log('  ✓ Saved: app/apple-icon.png (180×180)')

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
