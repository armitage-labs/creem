import { describe, expect, it } from 'vitest'
import checkoutButtonSource from '@/framer/checkout-button.tsx?raw'
import pricingTableSource from '@/framer/pricing-table.tsx?raw'

describe('inserted component sources', () => {
  it.each([
    ['checkout button', checkoutButtonSource],
    ['pricing table', pricingTableSource]
  ])('does not ship console logging in the %s', (_name, source) => {
    expect(source).not.toMatch(/console\.(?:log|error|warn|debug)\s*\(/)
  })
})
