import type { Product } from '@/types'
import { formatApiErrorMessage, parseApiErrorBody, parseProductsSearchResponse } from '@/utils/validation'

/**
 * @see https://docs.creem.io/api-reference/introduction
 * Production: https://api.creem.io/v1
 * Test:       https://test-api.creem.io/v1
 */
const API_CONFIG = {
  BASE_URL: {
    PRODUCTION: 'https://api.creem.io',
    TEST: 'https://test-api.creem.io',
    DEV_PROXY: {
      PRODUCTION: '/creem-api',
      TEST: '/creem-test-api'
    }
  },
  ENDPOINTS: {
    PRODUCTS_SEARCH: '/v1/products/search'
  },
  PAGE_SIZE: 50,
  REQUEST_TIMEOUT_MS: 15_000
}

export type FetchProductsOptions = {
  signal?: AbortSignal
  includeArchived?: boolean
}

export type FetchProductsResponse = {
  data?: Product[]
  error?: string
  syncedAt?: number
}

function getBaseUrl(testMode: boolean): string {
  return import.meta.env.DEV
    ? testMode
      ? API_CONFIG.BASE_URL.DEV_PROXY.TEST
      : API_CONFIG.BASE_URL.DEV_PROXY.PRODUCTION
    : testMode
      ? API_CONFIG.BASE_URL.TEST
      : API_CONFIG.BASE_URL.PRODUCTION
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  const timeoutId = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()
  if (init.signal) {
    if (init.signal.aborted) controller.abort()
    else init.signal.addEventListener('abort', onAbort)
  }
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    })
  } catch (err) {
    // The timeout and the caller's cancellation share one controller, so an
    // AbortError alone is ambiguous - the flag tells us the timeout fired.
    if (timedOut) throw new DOMException('Request timed out', 'TimeoutError')
    throw err
  } finally {
    window.clearTimeout(timeoutId)
    init.signal?.removeEventListener('abort', onAbort)
  }
}

async function readApiError(res: Response): Promise<string> {
  try {
    const json = await res.json()
    return formatApiErrorMessage(res.status, parseApiErrorBody(json))
  } catch {
    return formatApiErrorMessage(res.status, null)
  }
}

/**
 * Fetches all product pages from GET /v1/products/search.
 * When `includeArchived` is false, only active products are returned.
 * @see https://docs.creem.io/api-reference/endpoint/search-products
 */
export async function fetchProducts(apiKey: string, testMode: boolean, options: FetchProductsOptions = {}): Promise<FetchProductsResponse> {
  const { signal, includeArchived = false } = options
  if (!apiKey.trim()) {
    return { error: 'Missing API key. Add your key from the Creem dashboard.' }
  }
  try {
    const base = getBaseUrl(testMode)
    const allProducts: Product[] = []
    let page = 1
    let hasMore = true
    while (hasMore) {
      if (signal?.aborted) return { error: 'Request cancelled' }
      const params = new URLSearchParams({
        page_number: String(page),
        page_size: String(API_CONFIG.PAGE_SIZE)
      })
      const url = `${base}${API_CONFIG.ENDPOINTS.PRODUCTS_SEARCH}?${params.toString()}`
      const res = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            'x-api-key': apiKey.trim(),
            Accept: 'application/json'
          },
          signal
        },
        API_CONFIG.REQUEST_TIMEOUT_MS
      )
      if (!res.ok) return { error: await readApiError(res) }
      const json = await res.json()
      const parsed = parseProductsSearchResponse(json)
      if (!parsed) return { error: 'Unexpected API response format.' }
      allProducts.push(...parsed.items)
      hasMore = parsed.hasMore
      page += 1
      if (page > 100) break
    }
    const products = includeArchived ? allProducts : allProducts.filter(product => product.status === 'active')
    return {
      data: products,
      syncedAt: Date.now()
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') return { error: 'Request timed out. Check your connection and try again.' }
    if (err instanceof DOMException && err.name === 'AbortError') return { error: 'Request cancelled' }
    console.error('Fetch error:', err)
    return { error: 'Network error. Check your connection.' }
  }
}
