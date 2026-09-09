import { env } from './env'

/**
 * Credit packs offered on the pricing page.
 *
 * `productId` links a pack to a one-time product configured in the Creem
 * dashboard. When present, the Buy button opens a real Creem checkout and the
 * wallet is credited from the `checkout.completed` webhook. When absent (e.g.
 * you haven't set up products yet), a dev-only simulated purchase credits the
 * wallet directly so the demo still works end-to-end.
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

/** Look up a pack by the Creem product id attached to a completed checkout. */
export function getPackByProductId(productId: string): Pack | undefined {
  if (!productId) return undefined
  return PACKS.find((p) => p.productId && p.productId === productId)
}

/** Credit cost per generation, by media type. */
export const GENERATION_COST = {
  image: 5,
  video: 40,
} as const

export type MediaType = keyof typeof GENERATION_COST
