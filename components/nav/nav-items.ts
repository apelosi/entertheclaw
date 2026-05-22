export const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/stages', label: 'Stages' },
  { href: '/agents', label: 'Agents' },
  { href: '/characters', label: 'Characters' },
] as const

export function isNavActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
