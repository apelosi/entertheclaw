/**
 * OpenAI Images API (gpt-image-1) — transparent PNG with reference image edit.
 */
import { readFile } from 'fs/promises'
import OpenAI, { toFile } from 'openai'
import { STYLE_MATCH_PREFIX } from './brand-references'
import { OPENCLAW_LOGO_REFERENCE_PATH } from './brand-references'

export type OpenAIImageSize = '1024x1024' | '1536x1024' | '1024x1536'

export { OPENCLAW_LOGO_REFERENCE_PATH }

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  return new OpenAI({ apiKey })
}

function extractPngBuffer(response: OpenAI.Images.ImagesResponse): Buffer {
  const item = response.data?.[0]
  if (item?.b64_json) {
    return Buffer.from(item.b64_json, 'base64')
  }
  throw new Error('OpenAI returned no image data')
}

export async function generateOpenAIImage(opts: {
  prompt: string
  size?: OpenAIImageSize
  referencePath?: string
}): Promise<Buffer> {
  const client = getClient()
  const fullPrompt = STYLE_MATCH_PREFIX + opts.prompt
  const size = opts.size ?? '1024x1024'
  const refPath = opts.referencePath ?? OPENCLAW_LOGO_REFERENCE_PATH

  const refBytes = await readFile(refPath)
  const refFile = await toFile(refBytes, 'reference.png', { type: 'image/png' })

  const response = await client.images.edit({
    model: 'gpt-image-1',
    image: refFile,
    prompt: fullPrompt,
    size,
    background: 'transparent',
    output_format: 'png',
    input_fidelity: 'high',
  })

  return extractPngBuffer(response)
}
