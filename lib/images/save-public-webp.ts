import { writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'

/** Write a buffer to public/{filename}.webp */
export async function saveBufferAsWebp(filename: string, buffer: Buffer): Promise<string> {
  const outPath = join(process.cwd(), 'public', `${filename}.webp`)
  const webp = await sharp(buffer).webp({ quality: 90 }).toBuffer()
  await writeFile(outPath, webp)
  return `/${filename}.webp`
}

/** Download a remote image URL and save as public/{filename}.webp */
export async function saveUrlAsWebp(filename: string, url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download image (${res.status})`)
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  return saveBufferAsWebp(filename, buffer)
}
