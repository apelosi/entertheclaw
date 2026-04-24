const RECRAFT_API_URL = 'https://external.api.recraft.ai/v1'

export async function generatePixelArtSprite(prompt: string): Promise<string> {
  const response = await fetch(`${RECRAFT_API_URL}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RECRAFT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      style: 'pixel_art',
      width: 128,
      height: 128,
      n: 1,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Recraft API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  return (data.data?.[0]?.url as string) ?? ''
}

export async function generateLogoMark(prompt: string): Promise<string> {
  const response = await fetch(`${RECRAFT_API_URL}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RECRAFT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      style: 'vector_illustration',
      width: 512,
      height: 512,
      n: 1,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Recraft API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  return (data.data?.[0]?.url as string) ?? ''
}
