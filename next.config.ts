import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: '**.recraft.ai' },
    ],
  },
  serverExternalPackages: ['ws'],
  transpilePackages: ['@neondatabase/auth'],
}

export default nextConfig
