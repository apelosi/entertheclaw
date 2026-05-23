import fs from 'fs'
import os from 'os'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function isICloudRoot(dir) {
  return dir.includes('com~apple~CloudDocs')
}

function localNextDistDir() {
  if (process.env.ENTERTHECLAW_NEXT_DISTDIR) {
    return path.resolve(process.env.ENTERTHECLAW_NEXT_DISTDIR)
  }
  return path.join(os.homedir(), 'Library', 'Caches', 'entertheclaw-next')
}

function isProductionNextCommand() {
  if (process.env.NEXT_PHASE === 'phase-production-build') return true
  if (process.argv.some((a) => a === 'build' || a === 'start')) return true
  if (process.env.NODE_ENV === 'production') return true
  return false
}

function isDevelopmentNextCommand() {
  if (isProductionNextCommand()) return false
  if (process.argv.includes('dev') || process.env.npm_lifecycle_event === 'dev') {
    return true
  }
  return process.env.NODE_ENV === 'development'
}

function resolveDistDirAbsolute() {
  if (process.env.ENTERTHECLAW_LOCAL_NEXT_CACHE === '0') {
    return path.join(root, '.next')
  }
  const useLocalCache =
    process.env.ENTERTHECLAW_LOCAL_NEXT_CACHE === '1' ||
    Boolean(process.env.ENTERTHECLAW_NEXT_DISTDIR) ||
    (isDevelopmentNextCommand() && isICloudRoot(root))
  if (!useLocalCache) return path.join(root, '.next')
  return localNextDistDir()
}

function markNoSync(nextDir) {
  fs.mkdirSync(nextDir, { recursive: true })
  fs.writeFileSync(path.join(nextDir, '.nosync'), '')
  try {
    execSync(`xattr -w com.apple.fileprovider.ignore#P 1 "${nextDir}"`, {
      stdio: 'ignore',
    })
  } catch {
    // optional
  }
}

const nextDir = resolveDistDirAbsolute()
markNoSync(nextDir)
if (!nextDir.startsWith(root)) {
  console.log(`[entertheclaw] next dev cache → ${nextDir}`)
}
