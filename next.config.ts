import type { NextConfig } from 'next'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

/** iCloud Drive: keep `.next` local so webpack chunks are not evicted (ChunkLoadError). */
function markNextDirNoSync(projectDir: string) {
  const nextDir = path.join(projectDir, '.next')
  fs.mkdirSync(nextDir, { recursive: true })
  fs.writeFileSync(path.join(nextDir, '.nosync'), '')
  try {
    execSync(`xattr -w com.apple.fileprovider.ignore#P 1 "${nextDir}"`, { stdio: 'ignore' })
  } catch {
    // xattr optional on non-macOS
  }
}

class EnsureNextNosyncPlugin {
  constructor(private readonly projectDir: string) {}

  apply(compiler: {
    hooks: { done: { tap: (name: string, fn: () => void) => void } }
  }) {
    compiler.hooks.done.tap('EnsureNextNosync', () => {
      markNextDirNoSync(this.projectDir)
    })
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: '**.recraft.ai' },
    ],
  },
  serverExternalPackages: ['ws'],
  transpilePackages: ['@neondatabase/auth'],
  webpack(config, { dir, dev }) {
    if (dev) {
      markNextDirNoSync(dir)
      config.plugins = config.plugins ?? []
      config.plugins.push(new EnsureNextNosyncPlugin(dir))
    }
    return config
  },
}

export default nextConfig
