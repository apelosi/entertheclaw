import { generateGeminiBrandImage } from './gemini-brand-image'
import { generateOpenAIImage, type OpenAIImageSize } from './openai-image'
import {
  OPENCLAW_LOGO_REFERENCE_PATH,
  OPENCLAW_WORDMARK_REFERENCE_PATH,
  STYLE_MATCH_PREFIX,
} from './brand-references'
import type { ImagenAspectRatio } from './gemini'
import { whiteToAlpha } from './chroma-to-alpha'

export type BrandReference = 'logo' | 'wordmark'

function referencePath(kind: BrandReference): string {
  return kind === 'wordmark' ? OPENCLAW_WORDMARK_REFERENCE_PATH : OPENCLAW_LOGO_REFERENCE_PATH
}

function openAiSize(aspect: ImagenAspectRatio): OpenAIImageSize {
  return aspect === '16:9' ? '1536x1024' : '1024x1024'
}

/** Try OpenAI (reference edit), then Gemini editImage; apply white-to-alpha safety pass. */
export async function generateBrandImage(opts: {
  prompt: string
  reference?: BrandReference
  aspectRatio?: ImagenAspectRatio
  provider?: 'openai' | 'gemini' | 'auto'
}): Promise<Buffer> {
  const ref = referencePath(opts.reference ?? 'logo')
  const aspect = opts.aspectRatio ?? '1:1'
  const fullPrompt = STYLE_MATCH_PREFIX + opts.prompt
  const provider = opts.provider ?? 'auto'

  const tryOpenAI = provider === 'openai' || provider === 'auto'
  const tryGemini = provider === 'gemini' || provider === 'auto'

  if (tryOpenAI && process.env.OPENAI_API_KEY) {
    try {
      console.log('  → OpenAI gpt-image-1 (reference edit)')
      let buf = await generateOpenAIImage({
        prompt: opts.prompt,
        size: openAiSize(aspect),
        referencePath: ref,
      })
      buf = await whiteToAlpha(buf)
      return buf
    } catch (err) {
      console.warn('  OpenAI failed:', err instanceof Error ? err.message : err)
      if (provider === 'openai') throw err
    }
  }

  if (tryGemini && process.env.GEMINI_API_KEY) {
    console.log('  → Gemini imagen edit (reference image)')
    let buf = await generateGeminiBrandImage({
      prompt: fullPrompt,
      referencePath: ref,
      aspectRatio: aspect,
    })
    buf = await whiteToAlpha(buf)
    return buf
  }

  throw new Error('No image provider available (set OPENAI_API_KEY and/or GEMINI_API_KEY)')
}
