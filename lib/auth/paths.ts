export const AUTH_PATH = '/auth'

/** OAuth return handler (Neon popup / redirect). */
export const AUTH_CALLBACK_PATH = '/auth/callback'

export function authUrl(callbackUrl?: string): string {
  const url = new URL(AUTH_PATH, 'http://local')
  if (callbackUrl) {
    url.searchParams.set('callbackUrl', callbackUrl)
  }
  return `${url.pathname}${url.search}`
}
