import { creem } from '@creem_io/better-auth'
import { betterAuth } from 'better-auth'
import { pool } from './db'
import { env } from './env'
import { ensureWalletForUser } from './wallet'

/**
 * Better Auth configured with:
 *   - email/password auth over our Neon Postgres pool,
 *   - the official Creem plugin for checkout,
 *   - a sign-up hook that creates the user's `generation` wallet.
 *
 * Creem credits purchased packs itself, so there is no webhook handler here.
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
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // A Creem outage must not block sign-up: the routes call
          // ensureWalletForUser again and create the wallet then.
          await ensureWalletForUser(user).catch((err) => console.error('[auth] wallet not created at sign-up, will retry on first use:', err))
        },
      },
    },
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
    }),
  ],
})

export type Session = typeof auth.$Infer.Session
