import type { BillingPeriod, Product } from '@/types'

type BillingPeriodMeta = {
  label: string
  shortLabel: string
  suffix: string
}

/** Creem subscription intervals — Monthly, 3 Months, 6 Months, Yearly (+ daily). */
export const BILLING_PERIOD_META: Record<BillingPeriod, BillingPeriodMeta> = {
  'every-month': { label: 'Monthly', shortLabel: 'month', suffix: '/month' },
  'every-three-months': { label: '3 Months', shortLabel: '3 months', suffix: '/3 months' },
  'every-six-months': { label: '6 Months', shortLabel: '6 months', suffix: '/6 months' },
  'every-year': { label: 'Yearly', shortLabel: 'year', suffix: '/year' },
  'every-day': { label: 'Daily', shortLabel: 'day', suffix: '/day' },
  once: { label: 'One-time', shortLabel: '', suffix: '' }
}

export const RECURRING_BILLING_PERIODS: BillingPeriod[] = ['every-month', 'every-three-months', 'every-six-months', 'every-year', 'every-day']

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

export function matchesProductSearch(product: Pick<Product, 'id' | 'name' | 'description'>, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return product.name.toLowerCase().includes(q) || product.description.toLowerCase().includes(q) || product.id.toLowerCase().includes(q)
}

export type SelectedProductsResult = { products: Product[]; missingIds: [] } | { products: []; missingIds: string[] }

/**
 * Resolves a saved selection against the latest product snapshot without
 * non-null assertions. The all-or-nothing result prevents Framer mutations when
 * a refresh has made the wizard state stale.
 */
export function resolveSelectedProducts(selectedIds: readonly string[], products: readonly Product[]): SelectedProductsResult {
  const productsById = new Map(products.map(product => [product.id, product]))
  const resolved: Product[] = []
  const missingIds: string[] = []

  for (const id of selectedIds) {
    const product = productsById.get(id)
    if (product) resolved.push(product)
    else missingIds.push(id)
  }

  return missingIds.length > 0 ? { products: [], missingIds } : { products: resolved, missingIds: [] }
}
