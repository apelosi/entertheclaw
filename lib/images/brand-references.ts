import { join } from 'path'

export const OPENCLAW_LOGO_REFERENCE_PATH = join(
  process.cwd(),
  'public',
  'brand',
  'openclaw-logo-reference.png'
)

export const OPENCLAW_WORDMARK_REFERENCE_PATH = join(
  process.cwd(),
  'public',
  'brand',
  'openclaw-wordmark-reference.png'
)

/** Legacy single reference (card); prefer logo/wordmark refs above. */
export const OPENCLAW_REFERENCE_PATH = join(
  process.cwd(),
  'public',
  'brand',
  'openclaw-reference.png'
)

export const STYLE_MATCH_PREFIX =
  'Exactly match the visual style of the attached OpenClaw reference image: ' +
  'vector mascot lobster logo, bright saturated red shell, thick black outlines, ' +
  'white glossy highlight streaks on claws, long antennae, segmented body, ' +
  'large open right claw, narrow smirking eyes, athletic brand-mark proportions. ' +
  'Do NOT change to cute, chibi, pixel art, 3D render, or generic crab. '
