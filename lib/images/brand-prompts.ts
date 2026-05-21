/** Brand image prompts — attach matching reference image in ChatGPT or via API. */

export const LOGO_MARK_PROMPT =
  'App icon logo mark of the SAME OpenClaw lobster mascot as the reference. ' +
  'Theatrical Shakespeare reciting pose: one large open claw raised in a dramatic soliloquy gesture, other claw at chest. ' +
  'Preserve reference proportions, outline weight, red color, and claw shape. ' +
  'Transparent background only (alpha), not white, not checkerboard. No text, no words, no speech bubbles. ' +
  'Centered, readable at 32px. No robot, no pixel art, no emblem circle border.'

/** Isolated claw reshaped as letter C — used inside programmatic wordmark build. */
export const CLAW_LETTER_C_PROMPT =
  'Typographic capital letter C made from the reference lobster claw — same CHUNKY FILLED proportions as the mascot character claw. ' +
  'THICK solid red pincers with little empty space inside the C curve; bold black outlines; white glossy highlights; NOT thin, NOT hollow, NOT wire-thin outline. ' +
  'Wide rounded C opening faces RIGHT; pincers curve outward like a letter C, not pointing up, not a sharp V. ' +
  'Reshape to be more open and C-shaped than the reference pose but keep the mascot claw thickness and fill. ' +
  'NO full body, NO face, NO antennae, NO text. Transparent background. Centered.'

/** Full horizontal wordmark — single-shot fallback (models often stack text; prefer claw C + build). */
export const LOGO_WORDMARK_PROMPT =
  'Match the attached OpenClaw wordmark reference layout exactly: ONE horizontal line reading Enter the Claw. ' +
  'Same proportions, spacing, and claw-as-C placement as the reference — do not stack lines vertically. ' +
  'Every glyph including Enter the and law and the claw-C are brand red #C41E3A with thick black outlines and small white glossy highlights. ' +
  'NO white or cream letters, NO gray, NO separate lobster icon before the text, NO extra mascot. ' +
  'The claw replaces only the letter C: wide rounded C opening faces RIGHT, thick filled pincers like the reference claw. ' +
  'Tight kerning between "the ", claw-C, and "law". Transparent background only.'

export const HERO_AGENT_PROMPT =
  'Same OpenClaw lobster mascot as the reference — do not redesign the face, eyes, antennae, red shell, or claw style. ' +
  'Show full body (head through segmented tail) standing upright on small legs. ' +
  'Theatrical Shakespeare acting pose only: one large open claw raised high for a soliloquy, other claw at chest. Calm smirk, not angry. ' +
  'NOT a dab pose, NOT a fighting stance, NOT a different lobster species. ' +
  'Transparent background only. No stage, no curtains, no spotlight beam, no laser lines, no vertical streaks, no props, no extra objects.'

export const HERO_STAGE_PROMPT =
  'Crisp 8-bit pixel art theatrical stage, wide 2:1, SNES-era retro RPG detail — sharp pixels, rich curtain and floor detail, NOT chunky blur. ' +
  'Red velvet curtains, wooden stage floor. ' +
  'One modest overhead spotlight: small circular pool on the floor (~25% of image width), soft edges, NOT a huge blast of white. ' +
  'Light warm off-white (#FFF9F0) with subtle falloff — NOT harsh pure white, NOT yellow, NOT green, NOT lime, NOT teal, NOT outdoor grass. ' +
  'Indoor theater only — NO sky, NO trees, NO prison yard, NO grass floor. ' +
  'Spotlight pool centered at 65% from the left for the character. ' +
  'COMPLETELY EMPTY: no characters, no animals, no props. Left third darker for text overlay. No logos.'

export const HERO_AGENT_PIXEL_PROMPT =
  'Crisp 8-bit pixel art character sprite ONLY, SNES-era detail — sharp pixels, NOT chunky blur. ' +
  'Single red lobster mascot like OpenClaw brand: bright red #C41E3A shell, thick black pixel outlines, white highlights on claws, long antennae, smirking narrow eyes. ' +
  'Full body from head to tail standing on small legs. Shakespeare acting pose: one large open claw raised for soliloquy, other claw at chest. ' +
  'ISOLATED on flat solid pure white #FFFFFF background filling the entire frame. ' +
  'NO stage floor, NO wooden planks, NO curtains, NO backdrop, NO sky, NO spotlight beam, NO cast shadow on floor, NO scenery, NO props, NO text.'
