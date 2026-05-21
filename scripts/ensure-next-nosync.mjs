import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const nextDir = path.join(root, '.next')

fs.mkdirSync(nextDir, { recursive: true })
fs.writeFileSync(path.join(nextDir, '.nosync'), '')
try {
  execSync(`xattr -w com.apple.fileprovider.ignore#P 1 "${nextDir}"`, { stdio: 'ignore' })
} catch {
  // optional
}
