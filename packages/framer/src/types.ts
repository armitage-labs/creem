export type BillingPeriod = 'every-month' | 'every-three-months' | 'every-six-months' | 'every-year' | 'every-day' | 'once'

export type ProductStatus = 'active' | 'archived'

export type Product = {
  id: string
  name: string
  description: string
  /** Price in minor units (cents). Null when missing or invalid. */
  price: number | null
  currency: string
  type: 'one_time' | 'recurring'
  billingPeriod?: BillingPeriod
  status: ProductStatus
  image_url?: string
  /** Feature descriptions from the Creem product `features` array */
  features?: string[]
}

export type ProductPair = {
  baseName: string
  monthly: Product | null
  yearly: Product | null
  hasMonthly: boolean
  hasYearly: boolean
}

export type UnpairedProduct = {
  baseName: string
  hasMonthly: boolean
  hasYearly: boolean
  product: Product
}

export type TierConfig = {
  key: string
  name: string
  description: string
  features: string[]
  featuresTitle: string
  ctaText: string
  /** Optional per-tier button background. Falls back to accent/highlight defaults when unset. */
  ctaBackground?: string
  /** Optional per-tier button text color. Falls back to theme defaults when unset. */
  ctaTextColor?: string
  highlighted: boolean
}

// Application Types
export type Screen = 'home' | 'products' | 'insert' | 'productDetail'

export type InsertType = 'button' | 'pricing'

export type CheckoutType = 'new-tab' | 'embed'

export type BillingType = 'one_time' | 'recurring'

export type PricingInterval = 'monthly' | 'yearly'

export type PricingLayout = 'vertical' | 'grid' | 'horizontal'

export type GridColumns = 1 | 2 | 3 | 4 | 5
