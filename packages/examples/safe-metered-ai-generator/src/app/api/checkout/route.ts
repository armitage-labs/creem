import { creemClient } from '@/lib/creem/client'
import { env } from '@/lib/env'
import { getPack } from '@/lib/packs'
import { withUser } from '@/lib/session'
import { ensureWalletForUser } from '@/lib/wallet'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const Body = z.object({ packId: z.enum(['starter', 'pro', 'studio']) })

/**
 * A discount code pre-applied to every checkout. Set to a 100%-off code so test
 * purchases cost $0 while still exercising the real checkout and credit path. Set to `null` to charge full price.
 */
const DISCOUNT_CODE: string | null = 'APERTUREFREE'

/**
 * Start a credit-pack purchase.
 *
 * Every pack is mapped to a Creem product (CREEM_PRODUCT_*) that carries an "AI
 * generation credits" feature, so we create a Creem checkout and return its
 * URL. When the payment succeeds, Creem adds the product's credits to this
 * customer's generation wallet. There is nothing to credit on our side.
 */
export const POST = withUser(async (req, user) => {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  const pack = getPack(parsed.data.packId)
  if (!pack) return NextResponse.json({ error: 'unknown_pack' }, { status: 404 })
  try {
    // Check out as the user's existing Creem customer, so the credits land in
    // the generation wallet they already have.
    const wallet = await ensureWalletForUser(user)
    const checkout = await creemClient.checkouts.create({
      productId: pack.productId,
      customer: { id: wallet.creemCustomerId },
      successUrl: `${env.appUrl}/success`,
      ...(DISCOUNT_CODE ? { discountCode: DISCOUNT_CODE } : {}),
      metadata: { referenceId: user.id, packId: pack.id },
    })
    const url = checkout.checkoutUrl
    if (!url) throw new Error('checkout has no URL')
    return NextResponse.json({ mode: 'checkout', url })
  } catch (err) {
    console.error('[checkout] checkout create failed:', err)
    return NextResponse.json({ error: 'checkout_failed', message: 'Could not start checkout.' }, { status: 502 })
  }
})
