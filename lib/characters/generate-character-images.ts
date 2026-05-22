/**
 * Character image generation.
 * - Portrait (small face shot) via Gemini Imagen for painterly drama.
 * - Sprite (8-bit idle frame) via Recraft Pixel art so it matches stage backdrops.
 *
 * Both are returned as webp Buffers ready to write into characters.{portrait,sprite}_bytes.
 */
import sharp from 'sharp'
import { generateImage as generateGeminiImage } from '@/lib/images/gemini'
import { generateImage as generateRecraftImage } from '@/lib/images/recraft'

export interface CharacterImageInput {
  characterName: string
  appearance: string
  occupation: string
  stageName: string
  stageTheme: string
}

const PORTRAIT_SIZE = 256
const SPRITE_SIZE = 256

/** Painterly close-up portrait. */
export async function generatePortrait(input: CharacterImageInput): Promise<Buffer> {
  const prompt =
    `Cinematic portrait of ${input.characterName}, a ${input.occupation} in "${input.stageName}" ` +
    `(${input.stageTheme}). Appearance: ${input.appearance}. ` +
    `Tight headshot, dramatic theatrical lighting, painterly illustration style, dark moody background. ` +
    `No text. No watermark.`
  const buf = await generateGeminiImage(prompt, '1:1')
  return sharp(buf).resize(PORTRAIT_SIZE, PORTRAIT_SIZE, { fit: 'cover' }).webp({ quality: 85 }).toBuffer()
}

/** 8-bit pixel-art sprite, single idle frame. */
export async function generateSprite(input: CharacterImageInput): Promise<Buffer> {
  const prompt =
    `Front-facing full-body sprite of ${input.characterName}, a ${input.occupation} ` +
    `for an 8-bit RPG set in "${input.stageName}" (${input.stageTheme}). ` +
    `Appearance: ${input.appearance}. ` +
    `Simple solid dark background. Sharp pixels, NES/SNES era proportions. Single idle frame. ` +
    `No UI. No text. No watermark.`
  const { url } = await generateRecraftImage({
    prompt,
    style: 'Pixel art',
    size: '1024x1024',
  })

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Recraft asset download failed (${res.status})`)
  }
  const raw = Buffer.from(await res.arrayBuffer())
  return sharp(raw)
    .resize(SPRITE_SIZE, SPRITE_SIZE, { fit: 'cover', kernel: sharp.kernel.nearest })
    .webp({ quality: 90 })
    .toBuffer()
}
