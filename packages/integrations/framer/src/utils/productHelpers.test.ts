import { describe, expect, it } from 'vitest'
import type { Product } from '@/types'
import { resolveSelectedProducts } from '@/utils/productHelpers'

function product(id: string): Product {
  return {
    id,
    name: id,
    description: '',
    price: 100,
    currency: 'USD',
    type: 'one_time',
    status: 'active'
  }
}

describe('resolveSelectedProducts', () => {
  it('preserves selection order', () => {
    const result = resolveSelectedProducts(['second', 'first'], [product('first'), product('second')])

    expect(result.missingIds).toEqual([])
    expect(result.products.map(item => item.id)).toEqual(['second', 'first'])
  })

  it('returns no partial product list when the selection is stale', () => {
    const result = resolveSelectedProducts(['first', 'removed'], [product('first')])

    expect(result).toEqual({ products: [], missingIds: ['removed'] })
  })
})
