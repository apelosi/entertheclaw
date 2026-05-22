/**
 * Gemini Imagen edit with subject reference image.
 * Docs: client.models.editImage + SubjectReferenceImage
 */
import { readFile } from 'fs/promises'
import { GoogleGenAI, SubjectReferenceImage, SubjectReferenceType } from '@google/genai'
import type { ImagenAspectRatio } from './gemini'

const EDIT_MODEL = 'imagen-3.0-capability-001'

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  return new GoogleGenAI({ apiKey })
}

function aspectToEditAspect(aspect: ImagenAspectRatio): string {
  switch (aspect) {
    case '16:9':
      return '16:9'
    case '9:16':
      return '9:16'
    case '4:3':
      return '4:3'
    case '3:4':
      return '3:4'
    default:
      return '1:1'
  }
}

export async function generateGeminiBrandImage(opts: {
  prompt: string
  referencePath: string
  aspectRatio?: ImagenAspectRatio
}): Promise<Buffer> {
  const ai = getClient()
  const bytes = await readFile(opts.referencePath)
  const base64 = bytes.toString('base64')

  const subjectRef = new SubjectReferenceImage()
  subjectRef.referenceId = 1
  subjectRef.config = {
    subjectType: SubjectReferenceType.SUBJECT_TYPE_ANIMAL,
    subjectDescription: 'OpenClaw red lobster mascot logo',
  }
  subjectRef.referenceImage = {
    imageBytes: base64,
    mimeType: 'image/png',
  }

  const response = await ai.models.editImage({
    model: EDIT_MODEL,
    prompt: opts.prompt,
    referenceImages: [subjectRef],
    config: {
      numberOfImages: 1,
      aspectRatio: aspectToEditAspect(opts.aspectRatio ?? '1:1'),
      includeRaiReason: true,
    },
  })

  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes
  if (!imageBytes) throw new Error('Gemini editImage returned no image data')
  return Buffer.from(imageBytes, 'base64')
}
