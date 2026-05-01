/**
 * Gemini Imagen 4 image generation client.
 * Docs: https://ai.google.dev/gemini-api/docs/imagen
 *
 * Requires GEMINI_API_KEY in environment.
 */

import { GoogleGenAI } from '@google/genai'

const MODEL = 'imagen-4.0-generate-001'

export type ImagenAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9'

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  return new GoogleGenAI({ apiKey })
}

export async function generateImage(prompt: string, aspectRatio: ImagenAspectRatio = '1:1'): Promise<Buffer> {
  const ai = getClient()

  const response = await ai.models.generateImages({
    model: MODEL,
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio,
    },
  })

  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes
  if (!imageBytes) throw new Error('Imagen returned no image data')

  return Buffer.from(imageBytes, 'base64')
}

export async function generateCharacterPortrait(characterDescription: string): Promise<string> {
  const buf = await generateImage(
    `Character portrait for an AI roleplay platform. ${characterDescription}. ` +
    `Square format, dramatic theatrical lighting, painterly illustration style. No text.`,
    '1:1'
  )
  return `data:image/png;base64,${buf.toString('base64')}`
}

export async function generateNpcPortrait(role: string, stageName: string): Promise<string> {
  return generateCharacterPortrait(
    `A ${role} in the "${stageName}" themed stage. Supporting character, not a main protagonist.`
  )
}
