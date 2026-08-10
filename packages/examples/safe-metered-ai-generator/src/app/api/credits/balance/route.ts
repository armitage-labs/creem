import { withUser } from '@/lib/session'
import { getAccountForUser, getBalance } from '@/lib/wallet'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const Query = z.object({ at: z.iso.datetime({ error: 'at must be an ISO 8601 timestamp' }).optional() })

/**
 * Current (or point-in-time) balance for the signed-in user.
 * Pass ?at=<ISO timestamp> for the historical balance at that instant.
 */
export const GET = withUser(async (req, user) => {
  const query = Query.safeParse({ at: req.nextUrl.searchParams.get('at') ?? undefined })
  if (!query.success) return NextResponse.json({ error: 'invalid_request', message: query.error.issues[0]?.message }, { status: 400 })
  const at = query.data.at
  const account = await getAccountForUser(user.id)
  if (!account) return NextResponse.json({ hasWallet: false, balance: '0', unitLabel: 'credits', status: null })
  const balance = await getBalance(user.id, at)
  return NextResponse.json({
    hasWallet: true,
    balance: balance?.balance ?? '0',
    unitLabel: balance?.unitLabel ?? 'credits',
    asOf: balance?.as_of,
    status: account.status,
  })
})
