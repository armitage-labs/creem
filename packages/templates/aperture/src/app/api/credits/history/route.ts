import { withUser } from '@/lib/session'
import { listHistory } from '@/lib/wallet'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** Transaction history for the signed-in user's wallet, newest first. */
export const GET = withUser(async (_req, user) => {
  const entries = await listHistory(user.id, 100)
  return NextResponse.json({ entries })
})
