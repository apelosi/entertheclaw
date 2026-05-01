/**
 * CLI script: Generate crab/claw-inspired logo assets via Gemini Imagen 4.
 *
 * Usage:
 *   bun run logo:generate
 *
 * Writes to:
 *   public/logo-mark.png    — square mark / icon (1:1)
 *   public/logo-wordmark.png — wide horizontal wordmark (16:9)
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { writeFile } from 'fs/promises'
import { join } from 'path'
import { generateImage } from '../images/gemini'

const LOGO_MARK_PROMPT =
  'Flat minimalist app logo icon. ' +
  'A stylized anthropomorphic crab standing upright in an iconic martial arts fighting stance ' +
  'inspired by Bruce Lee in Enter the Dragon — body low, legs spread wide, ' +
  'both large pincer claws raised and open in an aggressive strike pose, crab shell visible on back. ' +
  'The entire crab is rendered as a single solid deep crimson red (#C41E3A) flat shape. ' +
  'Background is pure solid black (#0D0D0D). ' +
  'Exactly two colors: crimson and black. Zero gradients. Zero shading. Zero outlines. Zero textures. ' +
  'Clean flat vector silhouette. No humans. No text. No background scenery.'

const LOGO_WORDMARK_PROMPT =
  'Clean horizontal website logo wordmark. ' +
  'The text "ENTER THE CLAW" displayed in a single line from left to right. ' +
  'Font style: bold chunky all-caps slab serif inspired by the 1973 Bruce Lee "Enter the Dragon" ' +
  'movie poster title — thick strong strokes, wide letterforms, slight angular cinematic weight, ' +
  'all letters the same height. ' +
  'A small simple flat crab silhouette in crimson red sits immediately to the left of the word ENTER. ' +
  'Text and icon color: solid deep crimson red (#C41E3A) on pure solid black (#0D0D0D) background. ' +
  'No gradients. No textures. No decorative borders or frames. No human figures. ' +
  'No background scenes. Just the crab icon and the three words in a clean horizontal line.'

async function main() {
  console.log('Generating logo assets via Gemini Imagen 4...\n')

  const publicDir = join(process.cwd(), 'public')

  console.log('Generating logo mark...')
  try {
    const buf = await generateImage(LOGO_MARK_PROMPT, '1:1')
    await writeFile(join(publicDir, 'logo-mark.png'), buf)
    console.log('  ✓ Saved: public/logo-mark.png')
  } catch (err) {
    console.error('  ✗ Logo mark failed:', err instanceof Error ? err.message : err)
  }

  console.log('\nGenerating wordmark...')
  try {
    const buf = await generateImage(LOGO_WORDMARK_PROMPT, '16:9')
    await writeFile(join(publicDir, 'logo-wordmark.png'), buf)
    console.log('  ✓ Saved: public/logo-wordmark.png')
  } catch (err) {
    console.error('  ✗ Wordmark failed:', err instanceof Error ? err.message : err)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
