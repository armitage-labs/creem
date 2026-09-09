/**
 * Creates the three credit-pack products in Creem and prints the env lines to
 * paste into .env.local.
 *
 *   pnpm products:setup
 *
 * This saves you from creating Starter, Pro, and Studio by hand in the
 * dashboard. It only needs CREEM_API_KEY (the script picks test vs. production
 * mode from the key prefix), so set that in .env.local before running.
 *
 * The pack metadata is duplicated here on purpose: importing src/lib/packs.ts
 * would pull in the env validation, which requires the very CREEM_PRODUCT_* ids
 * this script exists to generate.
 */
import { Creem } from 'creem'

// CREEM_API_KEY is provided via `tsx --env-file=.env.local` (see package.json).

/** Mirrors the packs in src/lib/packs.ts. Keep the names and prices in sync. */
const PACKS = [
  { envVar: 'CREEM_PRODUCT_STARTER', name: 'Aperture Starter', credits: 200, priceUsd: 9 },
  { envVar: 'CREEM_PRODUCT_PRO', name: 'Aperture Pro', credits: 1000, priceUsd: 39 },
  { envVar: 'CREEM_PRODUCT_STUDIO', name: 'Aperture Studio', credits: 3000, priceUsd: 99 },
] as const

async function main() {
  const apiKey = process.env.CREEM_API_KEY
  if (!apiKey) throw new Error('CREEM_API_KEY is not set. Add it to .env.local before running this script.')
  if (!apiKey.startsWith('creem_')) throw new Error('CREEM_API_KEY must start with "creem_" (use a "creem_test_…" key for test mode).')

  const isTestMode = apiKey.startsWith('creem_test_')
  const creem = new Creem({ apiKey, server: isTestMode ? 'test' : 'prod' })

  console.log(`Creating ${PACKS.length} products in ${isTestMode ? 'test' : 'production'} mode …\n`)

  const lines: string[] = []
  for (const pack of PACKS) {
    const product = await creem.products.create(
      {
        name: pack.name,
        description: `${pack.credits.toLocaleString()} generation credits.`,
        price: pack.priceUsd * 100, // Creem expects the amount in cents.
        currency: 'USD',
        billingType: 'onetime',
      },
      // Scope the idempotency key to the mode so a re-run in the same mode
      // returns the existing product instead of creating a duplicate.
      `${pack.envVar}:${isTestMode ? 'test' : 'prod'}`,
    )
    console.log(`✓ ${pack.name} → ${product.id}`)
    lines.push(`${pack.envVar}="${product.id}"`)
  }

  console.log('\nDone. Add these to your .env.local:\n')
  console.log(lines.join('\n'))
}

main().catch((err) => {
  console.error('\nProduct setup failed:', err)
  process.exit(1)
})
