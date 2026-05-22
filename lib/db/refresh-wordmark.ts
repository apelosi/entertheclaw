/**
 * Build one-line wordmark (no OpenAI full image — avoids extra logo icon).
 * Usage: bun run wordmark:refresh
 */
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
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))))
  })
}

async function main() {
  await run('wordmark:build')
  console.log('\nDone.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
