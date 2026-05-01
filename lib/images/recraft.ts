/**
 * Recraft v3 image generation client.
 * Docs: https://www.recraft.ai/docs
 *
 * Requires RECRAFT_API_KEY in environment.
 * Note: Recraft image URLs are valid for ~90 days — store them in DB promptly.
 */

const RECRAFT_API = 'https://external.api.recraft.ai/v1/images/generations'

// Exact style string values as accepted by Recraft v3.
// Docs: https://www.recraft.ai/docs/api-reference/styles
export type RecraftStyle =
  | 'Pixel art'
  | 'Photorealism'
  | 'Illustration'
  | 'Hard Comics'
  | 'Graphic intensity'
  | 'Noir'
  | 'Pop art'
  | 'Prestige Emblem'
  | 'Pop Graphic'
  | 'Stamp'

export interface RecraftGenerateOptions {
  prompt: string
  style?: RecraftStyle
  /**
   * Image size — must be one of Recraft v3's accepted dimensions.
   * Default: 1820x1024 (16:9, good for stage backgrounds)
   * Full list: https://www.recraft.ai/docs/api-reference/appendix
   */
  size?:
    | '1024x1024'  // 1:1
    | '1820x1024'  // 16:9 landscape
    | '1024x1820'  // 9:16 portrait
    | '1536x1024'  // 3:2
    | '1024x1536'  // 2:3
    | '1365x1024'  // 4:3
    | '1024x1365'  // 3:4
    | '1280x1024'  // 5:4
    | '1434x1024'  // 14:10
    | '2048x1024'  // 2:1
  n?: number
}

export interface RecraftResult {
  url: string
}

export async function generateImage(opts: RecraftGenerateOptions): Promise<RecraftResult> {
  const apiKey = process.env.RECRAFT_API_KEY
  if (!apiKey) throw new Error('RECRAFT_API_KEY is not set')

  const body = {
    model: 'recraftv3',
    style: opts.style ?? 'Pixel art',
    prompt: opts.prompt,
    n: opts.n ?? 1,
    size: opts.size ?? '1820x1024',
  }

  const res = await fetch(RECRAFT_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Recraft API error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as { data: Array<{ url: string }> }
  const url = data?.data?.[0]?.url
  if (!url) throw new Error('Recraft returned no image URL')

  return { url }
}

// ---------------------------------------------------------------------------
// Convenience wrappers kept from original file
// ---------------------------------------------------------------------------

export async function generatePixelArtSprite(prompt: string): Promise<string> {
  const { url } = await generateImage({
    prompt,
    style: 'Pixel art',
    size: '1024x1024',
  })
  return url
}

export async function generateLogoMark(prompt: string): Promise<string> {
  const { url } = await generateImage({
    prompt,
    style: 'Hard Comics',
    size: '1024x1024',
  })
  return url
}
