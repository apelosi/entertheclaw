import { DISPLAY_NAME_ONBOARDING_PATH } from '@/lib/paths'

export const DISPLAY_NAME_MIN = 2
export const DISPLAY_NAME_MAX = 64

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
