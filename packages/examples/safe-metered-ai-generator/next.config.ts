import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ['*.loca.lt'],
  serverExternalPackages: ['@neondatabase/serverless'],
}

export default nextConfig
