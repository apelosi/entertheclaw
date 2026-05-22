import { DISPLAY_NAME_ONBOARDING_PATH } from '@/lib/paths'

export const DISPLAY_NAME_MIN = 2
export const DISPLAY_NAME_MAX = 64

export type DisplayNameUser = {
  name?: string | null
  email?: string | null
}

/** True when the user has no name or only the auto-generated email local-part placeholder. */
export function needsDisplayName(user: DisplayNameUser): boolean {
  const name = user.name?.trim()
  if (!name) return true
  const emailLocal = user.email?.split('@')[0]?.trim()
  if (emailLocal && name.toLowerCase() === emailLocal.toLowerCase()) return true
  return false
}

export function validateDisplayName(raw: string): string | null {
  const name = raw.trim()
  if (name.length < DISPLAY_NAME_MIN) {
    return `Display name must be at least ${DISPLAY_NAME_MIN} characters.`
  }
  if (name.length > DISPLAY_NAME_MAX) {
    return `Display name must be at most ${DISPLAY_NAME_MAX} characters.`
  }
  return null
}

export function displayNameOnboardingPath(callbackUrl?: string): string {
  if (!callbackUrl) return DISPLAY_NAME_ONBOARDING_PATH
  return `${DISPLAY_NAME_ONBOARDING_PATH}?callbackUrl=${encodeURIComponent(callbackUrl)}`
}
