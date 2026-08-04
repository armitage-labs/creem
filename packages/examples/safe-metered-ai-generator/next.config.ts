import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.loca.lt'],
  serverExternalPackages: ['@neondatabase/serverless'],
}

export default nextConfig
