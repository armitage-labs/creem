import { creem } from '@creem_io/better-auth'
import { betterAuth } from 'better-auth'
import { pool } from './db'
import { env } from './env'
import { ensureWalletForUser } from './wallet'

/**
 * Better Auth configured with:
 *   - email/password auth over our Neon Postgres pool,
 *   - the official Creem plugin for checkout,
 *   - email verification, after which the user's `generation` wallet is created.
 *
 * Creem credits purchased packs itself, so there is no webhook handler here.
 */
export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  database: pool,
  emailAndPassword: {
    enabled: true,
    // The wallet is found through the user's email, so the email has to be
    // proven before anyone gets a session or a wallet.
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    // Demo app: no mail server is wired up, so the link is printed to the
    // server console. Send a real email here in production.
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`\n[auth] Verification link for ${user.email}:\n${url}\n`)
    },
    afterEmailVerification: async (user) => {
      // A Creem outage must not block verification: the routes call
      // ensureWalletForUser again and create the wallet then.
      await ensureWalletForUser({ ...user, emailVerified: true }).catch((err) => console.error('[auth] wallet not created after verification, will retry on first use:', err))
    },
  },
  plugins: [
    creem({
      apiKey: env.creemApiKey,
      webhookSecret: env.creemWebhookSecret,
      testMode: env.isTestMode,
      defaultSuccessUrl: '/success',
      // We only sell one-time credit packs here, not subscriptions, but the
      // migrated schema includes the plugin's user/subscription tables, so
      // keep this on. The app itself reads the Creem customer id from its own
      // credit_account table, not from the plugin.
      persistSubscriptions: true,
    }),
  ],
})

export type Session = typeof auth.$Infer.Session
