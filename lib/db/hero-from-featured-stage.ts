/**
 * Copy a seeded stage image → hero-stage.webp (2048×1024) for compositing.
 * Default: The Clawshank Redemption (theater interior, matches Featured Stages).
 *
 * Usage: bun run hero:from-stage
 *        STAGE_NAME="Claw Wars" bun run hero:from-stage
 */
import { access } from 'fs/promises'
import { constants } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'
import { neon } from '@neondatabase/serverless'
import sharp from 'sharp'

dotenv.config({ path: '.env.local' })

/** Red velvet curtains, warm theater light — matches drama stage prompt */
const DEFAULT_STAGE = 'Enter the Claw'

async function main() {
  const name = process.env.STAGE_NAME?.trim() || DEFAULT_STAGE
  const sql = neon(process.env.DATABASE_URL!)
  const rows = await sql`SELECT image_url FROM stages WHERE name = ${name} LIMIT 1`
  if (!rows[0]?.image_url) {
    throw new Error(`Stage not found: ${name}`)
  }

  const rel = String(rows[0].image_url).replace(/^\//, '')
  const src = join(process.cwd(), 'public', rel)
  try {
    await access(src, constants.F_OK)
  } catch {
    throw new Error(`Missing file: ${src}`)
  }

  const out = join(process.cwd(), 'public', 'hero-stage.webp')
  await sharp(src)
    .resize(2048, 1024, { fit: 'cover', position: 'centre' })
    .webp({ quality: 90 })
    .toFile(out)

  console.log(`  ✓ hero-stage.webp ← ${name} (${rel})`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
