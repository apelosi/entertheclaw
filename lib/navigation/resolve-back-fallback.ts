/** Same-origin referer path for back fallback when session history is empty. */
export function resolveInternalBackFallback(
  referer: string | null,
  siteOrigin: string,
  currentPathname: string,
  defaultPath = '/agents',
): string {
  if (!referer) return defaultPath

  try {
    const ref = new URL(referer)
    if (ref.origin !== siteOrigin) return defaultPath
    const path = `${ref.pathname}${ref.search}`
    if (path === currentPathname) return defaultPath
    return path
  } catch {
    return defaultPath
  }
}
