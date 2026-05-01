/**
 * Prompt templates for AI image generation.
 *
 * All stage background prompts target 8-bit / retro RPG pixel art aesthetics
 * consistent with the "Grand Stage Terminal" design system.
 */

// ---------------------------------------------------------------------------
// Stage background prompts (16:9, wide establishing shots)
// ---------------------------------------------------------------------------

const STAGE_BACKGROUND_BASE =
  'retro RPG pixel art scene, 8-bit style, dark dramatic lighting, deep shadows, cinematic composition, rich colors'

export const STAGE_BACKGROUND_PROMPTS: Record<string, string> = {
  mythology:
    `8-bit pixel art ancient greek temple ruins at dusk, massive stone columns, crimson sky, torches flickering, dense fog rolling through the pillars, golden altar, ${STAGE_BACKGROUND_BASE}`,
  strategy:
    `8-bit pixel art medieval war room interior, large stone table covered with tactical maps and chess-like pieces, torchlight casting long shadows, stone walls with banners, ${STAGE_BACKGROUND_BASE}`,
  western:
    `8-bit pixel art saloon interior at night, wooden bar counter, oil lanterns, swinging doors, dusty floorboards, wanted posters on walls, moonlight through windows, ${STAGE_BACKGROUND_BASE}`,
  scifi:
    `8-bit pixel art futuristic space station interior, glowing neon panels, holographic displays, dark metallic corridors, stars visible through a viewport, cyberpunk atmosphere, ${STAGE_BACKGROUND_BASE}`,
  drama:
    `8-bit pixel art opulent theater stage with red velvet curtains, wooden floorboards, warm spotlight from above, elegant chandeliers in the dark background, ${STAGE_BACKGROUND_BASE}`,
  horror:
    `8-bit pixel art gothic mansion interior at night, crumbling stone walls, candles flickering in the dark, cobwebs, eerie green light, shadowy figure near doorway, ${STAGE_BACKGROUND_BASE}`,
  crime:
    `8-bit pixel art noir detective office at night, rain on window, single desk lamp casting hard shadows, filing cabinets, city lights in the background, cigarette smoke, ${STAGE_BACKGROUND_BASE}`,
  political:
    `8-bit pixel art grand senate chamber, curved marble tiers, red banners, dramatic overhead skylights, shadows and spotlights on the podium, ${STAGE_BACKGROUND_BASE}`,
  historical:
    `8-bit pixel art royal court chamber, gilded throne, stone archways, stained glass windows, candlelight, courtiers in the shadows, ${STAGE_BACKGROUND_BASE}`,
  sports:
    `8-bit pixel art empty stadium at night, floodlights casting harsh shadows on the field, dramatic sky, scoreboard glowing in the dark, ${STAGE_BACKGROUND_BASE}`,
  heist:
    `8-bit pixel art bank vault interior, stacked gold bars, security lasers cutting through the dark, steel door ajar, flashlight beams, ${STAGE_BACKGROUND_BASE}`,
  spy:
    `8-bit pixel art cold war era operations room, wall covered with maps and photographs, blinking radio equipment, green CRT monitors, shadowy figures, ${STAGE_BACKGROUND_BASE}`,
  legal:
    `8-bit pixel art courtroom at dusk, wooden pews, judge's high bench, tall arched windows with fading light, gavel on desk, ${STAGE_BACKGROUND_BASE}`,
  dystopia:
    `8-bit pixel art post-apocalyptic city ruins at night, crumbling skyscrapers, flickering neon signs, acid rain, surveillance drones in the smoggy sky, ${STAGE_BACKGROUND_BASE}`,
  'martial-arts':
    `8-bit pixel art ancient dojo interior, wooden training floor, rice paper screens, moonlight filtering in, weapon racks on the walls, candles, ${STAGE_BACKGROUND_BASE}`,
  shakespeare:
    `8-bit pixel art elizabethan theater stage, wooden thrust stage, torches along the gallery, painted backdrop of a forest, ornate wooden balcony, ${STAGE_BACKGROUND_BASE}`,
}

/** Fallback prompt when a theme has no specific template */
const DEFAULT_STAGE_PROMPT =
  `8-bit pixel art dramatic stage interior, deep shadows, crimson spotlight, wooden floorboards, dark curtains, ${STAGE_BACKGROUND_BASE}`

export function getStageBackgroundPrompt(theme: string): string {
  return STAGE_BACKGROUND_PROMPTS[theme] ?? DEFAULT_STAGE_PROMPT
}

// ---------------------------------------------------------------------------
// Character sprite prompts (square format, transparent-friendly)
// ---------------------------------------------------------------------------

/**
 * Build a character portrait prompt from character attributes.
 * Results are best used at 1:1 aspect ratio.
 */
export function getCharacterPortraitPrompt(params: {
  name?: string | null
  occupation?: string | null
  appearance?: string | null
  theme: string
}): string {
  const { name, occupation, appearance, theme } = params
  const themeTag = theme.replace('-', ' ')
  const parts = [
    '8-bit pixel art character portrait',
    occupation ? occupation : 'mysterious character',
    appearance ? appearance.slice(0, 120) : '',
    `${themeTag} setting`,
    'retro RPG style, expressive face, front-facing, dark background, pixel art',
  ].filter(Boolean)

  return parts.join(', ')
}

/**
 * Build a walking sprite sheet prompt (small, for the stage canvas).
 */
export function getCharacterSpritePrompt(params: {
  occupation?: string | null
  appearance?: string | null
  theme: string
}): string {
  const { occupation, appearance, theme } = params
  const themeTag = theme.replace('-', ' ')
  const parts = [
    '8-bit pixel art character sprite',
    occupation ? occupation : 'adventurer',
    appearance ? appearance.slice(0, 80) : '',
    `${themeTag} costume`,
    'retro RPG walking sprite, full body, transparent background, crisp pixels, 64x64',
  ].filter(Boolean)

  return parts.join(', ')
}
