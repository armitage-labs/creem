import { z } from 'zod'

/**
 * Centralised, typed access to environment configuration, validated with zod.
 *
 * Every external service this app depends on (Postgres, Better Auth, and Creem's
 * API, webhook, and products) must be fully configured. Missing or invalid keys
 * or secrets are a hard error at startup: the app never silently degrades to a
 * local or offline stand-in. zod's `safeParse` collects every problem at once,
 * so they can be fixed in a single pass.
 */

/** In env files an unset var and `FOO=""` are equivalent, so treat blanks as missing. */
const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const requiredString = z.preprocess(emptyToUndefined, z.string({ error: 'missing - set it in .env.local' }))
const optionalUrl = z.preprocess(emptyToUndefined, z.url('must be a valid URL').optional())

const EnvSchema = z.object({
  DATABASE_URL: requiredString,
  BETTER_AUTH_SECRET: requiredString,
  CREEM_API_KEY: z.preprocess(
    emptyToUndefined,
    z.string({ error: 'missing - set it in .env.local' }).startsWith('creem_', 'must start with "creem_" (use a "creem_test_…" key for test mode)'),
  ),
  CREEM_WEBHOOK_SECRET: requiredString,
  CREEM_PRODUCT_STARTER: requiredString,
  CREEM_PRODUCT_PRO: requiredString,
  CREEM_PRODUCT_STUDIO: requiredString,
  NEXT_PUBLIC_APP_URL: optionalUrl,
  BETTER_AUTH_URL: optionalUrl,
  GENERATOR: z.preprocess(emptyToUndefined, z.string().default('stub')),
})

const parsed = EnvSchema.safeParse(process.env)
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')
  throw new Error(`Invalid environment configuration:\n${details}\n\nCopy .env.example to .env.local and fill in every value before starting the app.`)
}

const e = parsed.data

/** Creem test keys are prefixed `creem_test_`; production keys are `creem_`. */
export const isTestMode = e.CREEM_API_KEY.startsWith('creem_test_')

export const env = {
  databaseUrl: e.DATABASE_URL,
  appUrl: e.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  betterAuthUrl: e.BETTER_AUTH_URL ?? e.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  betterAuthSecret: e.BETTER_AUTH_SECRET,
  creemApiKey: e.CREEM_API_KEY,
  creemWebhookSecret: e.CREEM_WEBHOOK_SECRET,
  isTestMode,
  generator: e.GENERATOR,
  products: {
    starter: e.CREEM_PRODUCT_STARTER,
    pro: e.CREEM_PRODUCT_PRO,
    studio: e.CREEM_PRODUCT_STUDIO,
  },
} as const
