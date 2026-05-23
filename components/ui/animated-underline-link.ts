/** Center-expand underline — matches `components/nav/nav-links.tsx`. */
const underlineAfter = [
  "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:content-['']",
  'after:origin-center after:scale-x-0',
  'after:transition-transform after:duration-150',
].join(' ')

const underlineBase = `relative transition-colors duration-100 ${underlineAfter}`

/** Community / My tabs and similar list nav. */
export function listTabLinkClass(isActive: boolean): string {
  return [
    underlineBase,
    'inline-flex h-8 items-center font-mono text-xs uppercase tracking-[0.1em]',
    isActive
      ? 'text-[#C41E3A] after:bg-[#C41E3A] after:scale-x-100'
      : 'text-[#888880] after:bg-[#3A3A3A] hover:text-[#F0EDE8] hover:after:scale-x-100',
  ].join(' ')
}

/** Stage / character / agent names on detail pages. */
export const detailPageLinkClass = [
  underlineBase,
  'text-[#F0EDE8] after:bg-[#C41E3A] hover:text-[#F0EDE8] hover:after:scale-x-100',
].join(' ')
