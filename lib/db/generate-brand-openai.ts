/**
 * CLI: Full OpenClaw brand regen (OpenAI mark/wordmark/agent + stage + composite + favicon).
 * Usage: bun run brand:generate:openai
 */
import { spawn } from 'child_process'

function run(script: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', ['run', script], { cwd: process.cwd(), stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? 1))
  })
}

async function main() {
  const steps = [
    'logo:generate:mark',
    'logo:generate:wordmark',
    'hero:generate:stage',
    'hero:generate:agent',
    'hero:composite',
    'favicon:generate',
  ]

  for (const step of steps) {
    const code = await run(step)
    if (code !== 0) process.exit(code)
  }

  console.log('\nBrand generation complete.')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
