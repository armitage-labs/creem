import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

/**
 * Better Auth catch-all handler. This also serves the Creem plugin routes. The
 * app needs no webhook: Creem credits purchases itself. If you add one for your
 * own purposes, the plugin serves it at /api/auth/creem/webhook and verifies
 * the signature.
 */
export const { GET, POST } = toNextJsHandler(auth)
