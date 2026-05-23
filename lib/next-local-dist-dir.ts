import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const ICLOUD_MARKER = 'com~apple~CloudDocs'

export function isICloudProjectRoot(root: string = process.cwd()): boolean {
  return root.includes(ICLOUD_MARKER)
}

/** Absolute path for dev output when the repo lives on iCloud Drive. */
export function localNextDistDir(): string {
  const explicit = process.env.ENTERTHECLAW_NEXT_DISTDIR
  if (explicit) return path.resolve(explicit)
  return path.join(os.homedir(), 'Library', 'Caches', 'entertheclaw-next')
}

/**
 * Use a distDir outside iCloud during `next dev` so webpack chunks are not evicted.
 * Override: ENTERTHECLAW_LOCAL_NEXT_CACHE=1|0, or ENTERTHECLAW_NEXT_DISTDIR=/path
 */
function isProductionNextCommand(argv: string[] = process.argv): boolean {
  if (process.env.NEXT_PHASE === 'phase-production-build') return true
  if (argv.some((a) => a === 'build' || a === 'start')) return true
  if (process.env.NODE_ENV === 'production') return true
  return false
}

/** True when `next dev` / local development (config is loaded without `dev` in argv). */
function isDevelopmentNextCommand(argv: string[] = process.argv): boolean {
  if (isProductionNextCommand(argv)) return false
  if (argv.includes('dev') || process.env.npm_lifecycle_event === 'dev') return true
  return process.env.NODE_ENV === 'development'
}

/** Relative distDir for Next (resolved with path.join(projectRoot, distDir)). */
export function resolveNextDistDir(
  argv: string[] = process.argv,
  root: string = process.cwd(),
): string {
  if (process.env.ENTERTHECLAW_LOCAL_NEXT_CACHE === '0') return '.next'
  const useLocalCache =
    process.env.ENTERTHECLAW_LOCAL_NEXT_CACHE === '1' ||
    Boolean(process.env.ENTERTHECLAW_NEXT_DISTDIR) ||
    (isDevelopmentNextCommand(argv) && isICloudProjectRoot(root))
  if (!useLocalCache) return '.next'

  const relative = path.relative(root, localNextDistDir())
  if (!relative || relative.startsWith('..')) return relative
  return relative
}

export function absoluteNextDistDir(
  projectRoot: string = process.cwd(),
  distDir: string = resolveNextDistDir(),
): string {
  return path.isAbsolute(distDir) ? distDir : path.join(projectRoot, distDir)
}

export function markNextDirNoSync(nextDir: string) {
  fs.mkdirSync(nextDir, { recursive: true })
  fs.writeFileSync(path.join(nextDir, '.nosync'), '')
  try {
    execSync(`xattr -w com.apple.fileprovider.ignore#P 1 "${nextDir}"`, { stdio: 'ignore' })
  } catch {
    // optional on non-macOS
  }
}
