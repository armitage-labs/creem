import { creem } from '@creem_io/better-auth'
import { betterAuth } from 'better-auth'
import { pool } from './db'
import { env } from './env'
import { getPackByProductId } from './packs'
import { ensureAccountForUser } from './wallet'

/**
 * Better Auth configured with:
 *   - email/password auth over our Neon Postgres pool,
 *   - the official Creem plugin for checkout + webhook handling,
 *   - an onCheckoutCompleted hook that credits the buyer's wallet when a
 *     one-time credit pack is purchased.
 *
 * The Creem webhook is served automatically at /api/auth/creem/webhook.
 */
export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  database: pool,
  emailAndPassword: {
    enabled: true,
    // Demo app: no email server wired up, so don't gate sign-in on verification.
    requireEmailVerification: false,
  },
  plugins: [
    creem({
      apiKey: env.creemApiKey,
      webhookSecret: env.creemWebhookSecret,
      testMode: env.isTestMode,
      defaultSuccessUrl: '/success',
      // We only sell one-time credit packs here, not subscriptions, but the
      // plugin still persists its user/subscription schema. Keep it on so
      // user.creemCustomerId is synced automatically on first checkout.
      persistSubscriptions: true,
      onCheckoutCompleted: async ({ customer, product, order, metadata }) => {
        const customerId = customer?.id
        const userId = metadata?.referenceId as string | undefined
        if (!customerId || !userId) {
          // Nothing to map this order onto - retrying won't help, so ACK it.
          console.warn('[creem] checkout.completed missing customerId/userId', { customerId, userId })
          return
        }
        const pack = getPackByProductId(product?.id ?? '')
        if (!pack) {
          // Not one of our credit packs - retrying won't help, so ACK it.
          console.warn('[creem] checkout.completed for unknown product, no credits granted:', product?.id)
          return
        }
        // Ensure the wallet exists for the now-known Creem customer, then credit
        // the pack amount. Both steps are idempotent - wallet creation on the
        // user id, the credit on the order id - so this is safe to run more than
        // once. We deliberately DON'T catch errors here: if crediting fails
        // (DB/Creem hiccup), letting it throw returns a non-2xx from the webhook
        // so Creem retries delivery. Swallowing it would ACK the webhook and the
        // buyer would silently lose their credits.
        const account = await ensureAccountForUser(userId, customerId)
        const { creditPack } = await import('./wallet')
        await creditPack({
          userId,
          accountId: account.accountId,
          amount: pack.credits,
          reference: `pack:${pack.id}:order:${order?.id ?? 'unknown'}`,
          idempotencyKey: `pack_${order?.id ?? `${userId}_${pack.id}`}`,
        })
        console.info(`[creem] Credited ${pack.credits} to ${userId} for pack ${pack.id}`)
      },
    }),
  ],
})

export type Session = typeof auth.$Infer.Session
