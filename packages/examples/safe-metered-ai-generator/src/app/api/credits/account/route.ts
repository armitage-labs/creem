import { withUser } from '@/lib/session'
import { closeAccount, freezeAccount, getAccountForUser, unfreezeAccount } from '@/lib/wallet'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const Body = z.object({ action: z.enum(['freeze', 'unfreeze', 'close']) })

/**
 * Demo operations over a user's credit account (freeze / unfreeze / close).
 *
 * These are exposed on the dashboard so you can see the lifecycle actions and
 * their audit-preserving semantics. In a production app they would NOT be
 * caller-invokable like this: they belong behind admin/ops authorization, with
 * every action written to an audit log and a confirmation step before it runs.
 */
export const POST = withUser(async (req, user) => {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  const account = await getAccountForUser(user.id)
  if (!account) return NextResponse.json({ error: 'no_wallet' }, { status: 404 })
  try {
    if (parsed.data.action === 'freeze') await freezeAccount(user.id)
    else if (parsed.data.action === 'unfreeze') await unfreezeAccount(user.id)
    else await closeAccount(user.id)
  } catch (err) {
    console.error('[account] lifecycle action failed:', err)
    return NextResponse.json({ error: 'action_failed', message: (err as Error).message }, { status: 502 })
  }
  const updated = await getAccountForUser(user.id)
  return NextResponse.json({ ok: true, status: updated?.status })
})
