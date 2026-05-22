/**
 * Build canonical wordmark derivatives from public/logo-wordmark.png.
 *
 * Usage: bun run wordmark:build
 */
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'

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
  console.log('Building wordmark derivatives from public/logo-wordmark.png...\n')

  const pngPath = join(process.cwd(), 'public', 'logo-wordmark.png')
  const source = await readFile(pngPath)
  const trimmed = await sharp(source).ensureAlpha().trim().png().toBuffer()
  const meta = await sharp(trimmed).metadata()

  await writeFile(pngPath, trimmed)
  await sharp(trimmed).webp({ quality: 90 }).toFile(join(process.cwd(), 'public', 'logo-wordmark.webp'))
  await writeWordmarkSvg(trimmed, meta.width ?? 1, meta.height ?? 1)

  console.log(`  ✓ ${meta.width}×${meta.height}px`)
  console.log('  ✓ public/logo-wordmark.png, .webp, .svg')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
