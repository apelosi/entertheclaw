export async function generateCharacterPortrait(
  characterDescription: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [
          {
            prompt: `Character portrait for an AI roleplay platform. ${characterDescription}. Square format, dramatic theatrical lighting, painterly illustration style. No text.`,
          },
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1',
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  // Returns base64 image data
  const b64 = data.predictions?.[0]?.bytesBase64Encoded as string | undefined
  return b64 ? `data:image/png;base64,${b64}` : ''
}

export async function generateNpcPortrait(
  role: string,
  stageName: string
): Promise<string> {
  return generateCharacterPortrait(
    `A ${role} in the "${stageName}" themed stage. Supporting character, not a main protagonist.`
  )
}
