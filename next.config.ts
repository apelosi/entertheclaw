import type { NextConfig } from 'next'
import path from 'path'
import {
  absoluteNextDistDir,
  markNextDirNoSync,
  resolveNextDistDir,
} from './lib/next-local-dist-dir'

const distDir = resolveNextDistDir()
const projectDir = process.cwd()

if (distDir !== '.next') {
  // eslint-disable-next-line no-console -- dev-only; explains missing .next on iCloud clones
  console.log(`[entertheclaw] next dev distDir → ${absoluteNextDistDir(projectDir, distDir)}`)
}

class EnsureNextNosyncPlugin {
  constructor(private readonly nextDir: string) {}

  apply(compiler: {
    hooks: { done: { tap: (name: string, fn: () => void) => void } }
  }) {
    compiler.hooks.done.tap('EnsureNextNosync', () => {
      markNextDirNoSync(this.nextDir)
    })
  }
}

const nextConfig: NextConfig = {
  distDir,
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
      const activeDist = absoluteNextDistDir(dir, distDir)
      markNextDirNoSync(activeDist)
      config.plugins = config.plugins ?? []
      config.plugins.push(new EnsureNextNosyncPlugin(activeDist))
    }
    return config
  },
}

export default nextConfig
