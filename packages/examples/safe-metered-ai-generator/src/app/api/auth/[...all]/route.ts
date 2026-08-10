import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

/**
 * Better Auth catch-all handler. This also serves the Creem plugin routes,
 * including the webhook at /api/auth/creem/webhook (set this URL in your Creem
 * dashboard). Signature verification happens inside the plugin.
 */
export const { GET, POST } = toNextJsHandler(auth)
