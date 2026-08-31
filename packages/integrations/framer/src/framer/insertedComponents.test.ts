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

  it('validates optional success redirects before adding them to checkout URLs', () => {
    expect(checkoutButtonSource).toContain("parsed.protocol !== 'https:'")
    expect(checkoutButtonSource).toContain('parsed.username || parsed.password')
    expect(checkoutButtonSource).toContain('successUrlValidation.valid')
    expect(checkoutButtonSource).toContain("searchParams.set('success_url', validatedSuccessUrl)")
  })

  it.each([
    ['checkout button', checkoutButtonSource],
    ['pricing table', pricingTableSource]
  ])('grants only the payment permission to the %s checkout iframe', (_name, source) => {
    expect(source).toContain("allow='payment *'")
    expect(source).not.toContain('clipboard-read')
    expect(source).not.toContain('clipboard-write')
  })

  it.each([
    ['checkout button', checkoutButtonSource],
    ['pricing table', pricingTableSource]
  ])('manages checkout dialog focus in the %s', (_name, source) => {
    expect(source).toContain('closeButtonRef.current?.focus()')
    expect(source).toContain('previouslyFocused?.focus()')
    expect(source).toContain('aria-labelledby={titleId}')
    expect(source).toContain('iframeRef.current?.focus()')
  })
})
