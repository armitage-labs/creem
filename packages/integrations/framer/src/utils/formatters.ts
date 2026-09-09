/**
 * Formatting Utilities
 * Functions for formatting prices, currencies, and display values
 */

import type { BillingPeriod } from '@/types'
import { getBillingPeriodSuffix } from '@/utils/productHelpers'

function resolveLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language
  return 'en-US'
}

/**
 * Formats a price with currency and optional billing period.
 * @param price - Price in minor units (cents). Null/invalid renders as unavailable.
 */
export function formatPrice(price: number | null | undefined, currency = 'USD', type?: 'one_time' | 'recurring', billingPeriod?: BillingPeriod, locale = resolveLocale()): string {
  if (price === null || price === undefined) return 'Price unavailable'
  if (price === 0) return 'Free'
  let amount: string
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency
    })
    // Currencies use different minor-unit exponents (0 for JPY/KRW, 2 for USD/EUR, 3 for BHD).
    const exponent = formatter.resolvedOptions().maximumFractionDigits ?? 2
    amount = formatter.format(price / 10 ** exponent)
  } catch {
    amount = `${(price / 100).toFixed(2)} ${currency}`
  }
  if (type === 'recurring' && billingPeriod) {
    const period = getBillingPeriodSuffix(billingPeriod)
    if (period === undefined) return `${amount} (${billingPeriod})`
    return `${amount}${period}`
  }
  return amount
}

export { getBillingPeriodDisplayLabel } from '@/utils/productHelpers'
