import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { auth } from './auth'

/** Resolve the current user from the request, or null. */
export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user ?? null
}

/** The authenticated user, as returned by Better Auth. */
export type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

/** Like getCurrentUser but throws a 401-style error for API routes. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) {
    const err = new Error('unauthorized') as Error & { status?: number }
    err.status = 401
    throw err
  }
  return user
}

/**
 * Wrap an API route handler so it only runs for an authenticated user, and
 * receives that validated `user` directly.
 *
 * This is the AUTHORITATIVE auth check (it calls Better Auth's `getSession`,
 * which verifies the session server-side) and the one that actually protects
 * the data. The `proxy.ts` cookie gate in front of these routes is only an
 * optimistic fast-fail; per Next.js + Better Auth guidance, every route still
 * validates here rather than trusting the proxy. It also removes the repeated
 * `getCurrentUser() → 401` boilerplate each route used to carry.
 */
export function withUser(handler: (req: NextRequest, user: SessionUser) => Promise<Response> | Response) {
  return async (req: NextRequest): Promise<Response> => {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    return handler(req, user)
  }
}
