import { writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import { whiteToAlpha } from './chroma-to-alpha'

export async function saveBufferAsPng(
  filename: string,
  buffer: Buffer,
  opts?: { stripWhite?: boolean }
): Promise<string> {
  let out = buffer
  if (opts?.stripWhite) {
    out = await whiteToAlpha(buffer)
  }
  const outPath = join(process.cwd(), 'public', `${filename}.png`)
  await writeFile(outPath, out)
  return `/${filename}.png`
}

export async function savePngAsWebp(filename: string, pngBuffer: Buffer): Promise<string> {
  const webpPath = join(process.cwd(), 'public', `${filename}.webp`)
  const webp = await sharp(pngBuffer).webp({ quality: 90 }).toBuffer()
  await writeFile(webpPath, webp)
  return `/${filename}.webp`
}
