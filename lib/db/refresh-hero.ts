/**
 * Refresh hero: seeded theater stage → composite (no Recraft, no postprocess).
 * Usage: bun run hero:refresh
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

function run(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', ['run', script], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${script} exited with ${code}`))
    })
  })
}

async function main() {
  console.log('Refreshing hero (Clawshank theater stage → composite)...\n')
  await run('hero:from-stage')
  await run('hero:composite')
  console.log('\nDone. Homepage uses public/hero-banner.webp')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
