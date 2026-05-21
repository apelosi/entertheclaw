import { mkdir, writeFile, access } from 'fs/promises'
import { join } from 'path'
import { constants } from 'fs'

export function stageImagePublicPath(stageId: string, ext = 'webp'): string {
  return `/stages/${stageId}.${ext}`
}

export function stageImageFilePath(stageId: string, ext = 'webp'): string {
  return join(process.cwd(), 'public', 'stages', `${stageId}.${ext}`)
}

export async function stageImageFileExists(stageId: string): Promise<boolean> {
  for (const ext of ['webp', 'png', 'jpg', 'jpeg']) {
    try {
      await access(stageImageFilePath(stageId, ext), constants.F_OK)
      return true
    } catch {
      // try next extension
    }
  }
  return false
}

/** True when the DB points at a remote URL we should replace with a local file. */
export function isRemoteStageImageUrl(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false
  return imageUrl.startsWith('http://') || imageUrl.startsWith('https://')
}

export async function persistStageImageFromUrl(
  stageId: string,
  remoteUrl: string
): Promise<string> {
  const res = await fetch(remoteUrl)
  if (!res.ok) {
    throw new Error(`Failed to download stage image (${res.status})`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('jpeg') || contentType.includes('jpg')
      ? 'jpg'
      : 'webp'

  const dir = join(process.cwd(), 'public', 'stages')
  await mkdir(dir, { recursive: true })

  const buffer = Buffer.from(await res.arrayBuffer())
  await writeFile(stageImageFilePath(stageId, ext), buffer)

  return stageImagePublicPath(stageId, ext)
}
