import { getSessionCookie } from 'better-auth/cookies'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * Next.js Proxy (formerly "middleware") - the optimistic auth gate.
 *
 * This runs before the protected API routes and rejects requests that carry no
 * session cookie at all, so unauthenticated traffic is turned away cheaply
 * without hitting the database.
 *
 * IMPORTANT: this is only an OPTIMISTIC check. A cookie's mere presence is not
 * proof of a valid session - it can be forged - so it is NOT sufficient on its
 * own. The authoritative check (Better Auth's `getSession`, which validates the
 * session server-side) still happens inside every route via `withUser`. Both
 * Next.js and Better Auth explicitly recommend this two-layer split: a fast
 * cookie gate here, real validation at the data access layer.
 *
 * Note: `/api/auth/*` is deliberately excluded - those endpoints (sign-in,
 * sign-up, the Creem webhook) must stay reachable without a session.
 */
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.next()
}

export const config = {
  // Protected API surface only. Keep `/api/auth` out so auth + webhook flows work.
  matcher: ['/api/checkout', '/api/generate', '/api/generations', '/api/credits/:path*'],
}
