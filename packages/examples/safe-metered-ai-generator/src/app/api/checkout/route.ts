import { env } from '@/lib/env'
import { getPack } from '@/lib/packs'
import { withUser } from '@/lib/session'
import { createCheckout } from '@creem_io/better-auth/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const Body = z.object({ packId: z.enum(['starter', 'pro', 'studio']) })

/**
 * A discount code pre-applied to every checkout. Set to a 100%-off code so test
 * purchases cost $0 while still exercising the real checkout, webhook, and credit
 * path. Set to `null` to charge full price.
 */
const DISCOUNT_CODE: string | null = 'APERTUREFREE'

/**
 * Start a credit-pack purchase.
 *
 * Every pack is mapped to a real Creem product (CREEM_PRODUCT_*), so we create a
 * Creem checkout and return its URL. The wallet is credited later, from the
 * `checkout.completed` webhook (see lib/auth.ts).
 */
export const POST = withUser(async (req, user) => {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  const pack = getPack(parsed.data.packId)
  if (!pack) return NextResponse.json({ error: 'unknown_pack' }, { status: 404 })
  try {
    const { url } = await createCheckout(
      { apiKey: env.creemApiKey, testMode: env.isTestMode },
      {
        productId: pack.productId,
        customer: { email: user.email },
        successUrl: `${env.appUrl}/success`,
        ...(DISCOUNT_CODE ? { discountCode: DISCOUNT_CODE } : {}),
        // referenceId lets the webhook map the order back to this user.
        metadata: { referenceId: user.id, packId: pack.id },
      },
    )
    return NextResponse.json({ mode: 'checkout', url })
  } catch (err) {
    console.error('[checkout] createCheckout failed:', err)
    return NextResponse.json({ error: 'checkout_failed', message: 'Could not start checkout.' }, { status: 502 })
  }
})
