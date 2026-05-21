/**
 * CLI script: Generate all logo assets (mark then wordmark).
 *
 * Usage:
 *   bun run logo:generate
 */
import { spawn } from 'child_process'

function run(script: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', ['run', script], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
    })
    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? 1))
  })
}

async function main() {
  const markCode = await run('logo:generate:mark')
  if (markCode !== 0) process.exit(markCode)

  const wordmarkCode = await run('logo:generate:wordmark')
  if (wordmarkCode !== 0) process.exit(wordmarkCode)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
