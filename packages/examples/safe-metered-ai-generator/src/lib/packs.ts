import { env } from './env'

/**
 * Credit packs offered on the pricing page.
 *
 * `productId` links a pack to a one-time product in Creem that carries an
 * "AI generation credits" feature. The Buy button opens a Creem checkout for
 * it, and Creem adds the product's credits to the buyer's generation wallet
 * when the payment succeeds. The app does not credit purchases itself.
 *
 * `credits` and `priceUsd` here are display copy for the pricing cards. The
 * amount actually granted is the one set on the product in Creem, so keep the
 * two in sync (`pnpm products:setup` creates the products from these numbers).
 */
export type Pack = {
  id: 'starter' | 'pro' | 'studio'
  name: string
  credits: number
  priceUsd: number
  blurb: string
  featured?: boolean
  productId: string
}

export const PACKS: Pack[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 200,
    priceUsd: 9,
    blurb: 'Kick the tires. ~40 images or a handful of clips.',
    productId: env.products.starter,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 1000,
    priceUsd: 39,
    blurb: 'For regular creators. Best value per credit.',
    featured: true,
    productId: env.products.pro,
  },
  {
    id: 'studio',
    name: 'Studio',
    credits: 3000,
    priceUsd: 99,
    blurb: 'High-volume production workloads.',
    productId: env.products.studio,
  },
]

export function getPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id)
}

/** Free credits a new user's generation wallet starts with. Set to 0 for none. */
export const WELCOME_CREDITS = 20

/** Credit cost per generation, by media type. */
export const GENERATION_COST = {
  image: 5,
  video: 40,
} as const

export type MediaType = keyof typeof GENERATION_COST
