/** Shared treatment for stage art (cards). */
export const STAGE_IMAGE_SCRIM_CLASS =
  'absolute inset-0 bg-gradient-to-t from-[#201f1f] via-[#201f1f]/40 to-transparent'

export const STAGE_IMAGE_CLASS = 'object-cover opacity-80 image-pixelated'

/** Hero banner: brighter on mobile; stage-card match on md+ open areas. */
export const HERO_IMAGE_CLASS =
  'object-cover image-pixelated opacity-100 max-md:saturate-110 md:opacity-80'

/** Lighter on mobile so the stage stays recognizable; full scrim on desktop. */
export const HERO_STAGE_SCRIM_CLASS = [
  'absolute inset-0',
  'max-md:bg-gradient-to-t max-md:from-[#201f1f]/35 max-md:via-transparent max-md:to-transparent',
  'md:bg-gradient-to-t md:from-[#201f1f] md:via-[#201f1f]/40 md:to-transparent',
].join(' ')

/** Hero copy column — swap GRADIENT for GLASS after browser preview. */
const HERO_TEXT_ZONE_BASE =
  'pointer-events-none absolute inset-y-0 left-0 z-[2] w-full max-md:max-w-none max-w-[min(100%,520px)]'

export const HERO_TEXT_ZONE_GRADIENT = [
  HERO_TEXT_ZONE_BASE,
  'bg-gradient-to-r from-[#0e0e0e]/90 via-[#0e0e0e]/65 to-transparent',
  'max-md:from-[#0e0e0e]/50 max-md:via-[#0e0e0e]/25 max-md:to-transparent',
].join(' ')

export const HERO_TEXT_ZONE_GLASS = [
  HERO_TEXT_ZONE_BASE,
  'bg-[#0e0e0e]/70 backdrop-blur-md',
].join(' ')

/** Active hero text-zone treatment. */
export const HERO_TEXT_ZONE_CLASS = HERO_TEXT_ZONE_GRADIENT
