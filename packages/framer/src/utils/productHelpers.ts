import type { BillingPeriod, Product, ProductPair, UnpairedProduct } from '@/types'

export type BillingPeriodPairSlot = 'monthly' | 'yearly'

type BillingPeriodMeta = {
  label: string
  shortLabel: string
  suffix: string
  pairSlot: BillingPeriodPairSlot | null
}

/** Creem subscription intervals — Monthly, 3 Months, 6 Months, Yearly (+ daily). */
export const BILLING_PERIOD_META: Record<BillingPeriod, BillingPeriodMeta> = {
  'every-month': { label: 'Monthly', shortLabel: 'month', suffix: '/month', pairSlot: 'monthly' },
  'every-three-months': { label: '3 Months', shortLabel: '3 months', suffix: '/3 months', pairSlot: null },
  'every-six-months': { label: '6 Months', shortLabel: '6 months', suffix: '/6 months', pairSlot: null },
  'every-year': { label: 'Yearly', shortLabel: 'year', suffix: '/year', pairSlot: 'yearly' },
  'every-day': { label: 'Daily', shortLabel: 'day', suffix: '/day', pairSlot: null },
  once: { label: 'One-time', shortLabel: '', suffix: '', pairSlot: null }
}

export const RECURRING_BILLING_PERIODS: BillingPeriod[] = ['every-month', 'every-three-months', 'every-six-months', 'every-year', 'every-day']

function getBaseName(name: string): string {
  return name
    .replace(/\s*\(monthly\)\s*/gi, ' ')
    .replace(/\s*\(yearly\)\s*/gi, ' ')
    .replace(/\s*\(annual\)\s*/gi, ' ')
    .replace(/\s*\(3\s*months?\)\s*/gi, ' ')
    .replace(/\s*\(6\s*months?\)\s*/gi, ' ')
    .replace(/\s*-\s*monthly\s*/gi, ' ')
    .replace(/\s*-\s*yearly\s*/gi, ' ')
    .replace(/\s*-\s*annual\s*/gi, ' ')
    .replace(/\s*-\s*3\s*months?\s*/gi, ' ')
    .replace(/\s*-\s*6\s*months?\s*/gi, ' ')
    .replace(/\s*\/month\s*/gi, ' ')
    .replace(/\s*\/year\s*/gi, ' ')
    .replace(/\s*\/3\s*months?\s*/gi, ' ')
    .replace(/\s*\/6\s*months?\s*/gi, ' ')
    .replace(/\s*per month\s*/gi, ' ')
    .replace(/\s*per year\s*/gi, ' ')
    .replace(/\s*per 3\s*months?\s*/gi, ' ')
    .replace(/\s*per 6\s*months?\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getPairKey(product: Product): string {
  return getBaseName(product.name)
}

export function getProductPairKey(product: Product): string {
  return getPairKey(product)
}

/**
 * Products shown as individual tiers (one-time + recurring not in a complete monthly/yearly pair).
 */
export function getIndividualPricingProducts(products: Product[]): Product[] {
  const pairedBaseNames = new Set(getProductPairs(products).map(pair => pair.baseName))
  return products.filter(product => {
    if (product.type === 'one_time') return true
    return !pairedBaseNames.has(getPairKey(product))
  })
}

export function isMonthlyPeriod(period?: BillingPeriod): boolean {
  return period === 'every-month'
}

export function isYearlyPeriod(period?: BillingPeriod): boolean {
  return period === 'every-year'
}

export function isThreeMonthPeriod(period?: BillingPeriod): boolean {
  return period === 'every-three-months'
}

export function isSixMonthPeriod(period?: BillingPeriod): boolean {
  return period === 'every-six-months'
}

export function isDailyPeriod(period?: BillingPeriod): boolean {
  return period === 'every-day'
}

export function getBillingPeriodPairSlot(period?: BillingPeriod): BillingPeriodPairSlot | null {
  if (!period) return null
  return BILLING_PERIOD_META[period]?.pairSlot ?? null
}

export function getBillingPeriodLabel(period?: BillingPeriod): string {
  if (!period) return 'Unknown'
  return BILLING_PERIOD_META[period]?.label ?? period
}

export function getBillingPeriodSuffix(period?: BillingPeriod): string | undefined {
  if (!period) return undefined
  const suffix = BILLING_PERIOD_META[period]?.suffix
  return suffix || undefined
}

/** Short label for pricing tables, e.g. "month", "year", "3 months". */
export function getBillingPeriodDisplayLabel(period?: BillingPeriod): string | null {
  if (!period || period === 'once') return null
  const shortLabel = BILLING_PERIOD_META[period]?.shortLabel
  return shortLabel || period
}

function assignToPair(pair: ProductPair, product: Product): void {
  const slot = getBillingPeriodPairSlot(product.billingPeriod)
  if (slot === 'monthly' && !pair.monthly) {
    pair.monthly = product
    pair.hasMonthly = true
    return
  }
  if (slot === 'yearly' && !pair.yearly) {
    pair.yearly = product
    pair.hasYearly = true
  }
}

/**
 * Groups recurring products into monthly/yearly pairs using name + billing period.
 * Only every-month and every-year variants pair; 3-month, 6-month, and daily products are excluded.
 */
export function getProductPairs(products: Product[], billingType?: 'one_time' | 'recurring'): ProductPair[] {
  if (billingType === 'one_time') return []
  const recurringProducts = products.filter(p => p.type === 'recurring')
  const pairMap = new Map<string, ProductPair>()
  recurringProducts.forEach(product => {
    const baseName = getPairKey(product)
    if (!pairMap.has(baseName)) {
      pairMap.set(baseName, {
        baseName,
        monthly: null,
        yearly: null,
        hasMonthly: false,
        hasYearly: false
      })
    }
    assignToPair(pairMap.get(baseName)!, product)
  })
  return Array.from(pairMap.values()).filter(p => p.hasMonthly && p.hasYearly)
}

/**
 * Finds products that have only one billing variant (incomplete pairs).
 */
export function getUnpairedProducts(products: Product[], billingType?: 'one_time' | 'recurring'): UnpairedProduct[] {
  if (billingType === 'one_time') return []
  const recurringProducts = products.filter(p => p.type === 'recurring')
  const pairMap = new Map<string, { baseName: string; monthly: Product | null; yearly: Product | null }>()
  recurringProducts.forEach(product => {
    const baseName = getPairKey(product)
    if (!pairMap.has(baseName)) {
      pairMap.set(baseName, { baseName, monthly: null, yearly: null })
    }
    const pair = pairMap.get(baseName)!
    const slot = getBillingPeriodPairSlot(product.billingPeriod)
    if (slot === 'monthly' && !pair.monthly) pair.monthly = product
    else if (slot === 'yearly' && !pair.yearly) pair.yearly = product
  })
  const incompletePairs = Array.from(pairMap.values())
    .filter(p => (p.monthly && !p.yearly) || (!p.monthly && p.yearly))
    .map(p => ({
      baseName: p.baseName,
      hasMonthly: !!p.monthly,
      hasYearly: !!p.yearly,
      product: p.monthly || p.yearly!
    }))
  const nonPairable = recurringProducts
    .filter(p => getBillingPeriodPairSlot(p.billingPeriod) === null)
    .map(p => ({
      baseName: getPairKey(p),
      hasMonthly: false,
      hasYearly: false,
      product: p
    }))
  return [...incompletePairs, ...nonPairable]
}

export function matchesProductSearch(product: Pick<Product, 'id' | 'name' | 'description'>, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return product.name.toLowerCase().includes(q) || product.description.toLowerCase().includes(q) || product.id.toLowerCase().includes(q)
}
