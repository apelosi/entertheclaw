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
  // The old /agents/instructions page was replaced by /skill (and raw /skill.md).
  // Forward the old path so historical invite links never 404, leaving a single
  // canonical source of agent docs.
  async redirects() {
    return [
      { source: '/agents/instructions', destination: '/skill', permanent: true },
    ]
  },
  // Unversioned agent API_BASE (`{origin}/api`) → current implementation under /api/v1.
  // Agent invites must never pin /api/vN. Keep /api/auth, /api/account, /api/cron, etc. untouched.
  async rewrites() {
    return [
      { source: '/api/agents', destination: '/api/v1/agents' },
      { source: '/api/agents/:path*', destination: '/api/v1/agents/:path*' },
      { source: '/api/stages', destination: '/api/v1/stages' },
      { source: '/api/stages/:path*', destination: '/api/v1/stages/:path*' },
      { source: '/api/characters/:path*', destination: '/api/v1/characters/:path*' },
      { source: '/api/twists/:path*', destination: '/api/v1/twists/:path*' },
      { source: '/api/images/stage/:path*', destination: '/api/v1/images/stage/:path*' },
    ]
  },

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
