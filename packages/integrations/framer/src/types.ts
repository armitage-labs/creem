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

export type TierConfig = {
  key: string
  name: string
  description: string
  ctaText: string
  highlighted: boolean
}

// Multi-store / environment
export type StoreEnv = 'live' | 'test'

/** A Creem store the user manages. Holds one key per environment; either may be empty. */
export type Store = {
  id: string
  name: string
  liveKey: string
  testKey: string
}

export type StoresState = {
  stores: Store[]
  activeStoreId: string
  activeEnv: StoreEnv
}

/** Everything the connected UI needs to render + drive the store/env switcher. */
export type StoreControls = {
  stores: Store[]
  activeStore?: Store
  activeEnv: StoreEnv
  switchStore: (id: string) => void
  switchEnv: (env: StoreEnv) => void
  /** Select a store and environment together (store must have that env's key). */
  selectStoreEnv: (id: string, env: StoreEnv) => void
  /** Open the "add a new store" flow. */
  addStore: () => void
  renameStore: (id: string, name: string) => void
  removeStore: (id: string) => void
  /** Add or replace a key on a store (re-slotted by prefix). */
  addKey: (id: string, key: string) => void
  /** Remove all stores and return to the onboarding screen. */
  signOut: () => void
}

// Application Types
export type Screen = 'home' | 'connected'

export type InsertType = 'button' | 'pricing'

export type CheckoutType = 'new-tab' | 'embed'

export type BillingType = 'one_time' | 'recurring'

export type PricingLayout = 'vertical' | 'grid' | 'horizontal'

export type GridColumns = 1 | 2 | 3 | 4 | 5
