import type { BillingPeriod, Product, ProductStatus } from '@/types'

const BILLING_PERIODS: BillingPeriod[] = ['every-month', 'every-three-months', 'every-six-months', 'every-year', 'every-day', 'once']

const PRODUCT_STATUSES: ProductStatus[] = ['active', 'archived']

export type ApiErrorBody = {
  trace_id?: string
  status?: number
  error?: string
  message?: string | string[]
  timestamp?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return value
}

function parseBillingPeriod(value: unknown): BillingPeriod | undefined {
  if (typeof value !== 'string') return undefined
  return BILLING_PERIODS.includes(value as BillingPeriod) ? (value as BillingPeriod) : undefined
}

function parseBillingType(value: unknown): 'one_time' | 'recurring' {
  return value === 'recurring' ? 'recurring' : 'one_time'
}

function parseStatus(value: unknown): ProductStatus {
  if (typeof value === 'string' && PRODUCT_STATUSES.includes(value as ProductStatus)) return value as ProductStatus
  return 'active'
}

function parseFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => {
      if (!isRecord(item)) return null
      const description = item.description
      return typeof description === 'string' && description.trim() ? description.trim() : null
    })
    .filter((feature): feature is string => feature !== null)
}

export function parseApiErrorBody(json: unknown): ApiErrorBody | null {
  if (!isRecord(json)) return null
  return {
    trace_id: typeof json.trace_id === 'string' ? json.trace_id : undefined,
    status: typeof json.status === 'number' ? json.status : undefined,
    error: typeof json.error === 'string' ? json.error : undefined,
    message: Array.isArray(json.message) ? json.message.filter((item): item is string => typeof item === 'string') : typeof json.message === 'string' ? json.message : undefined,
    timestamp: typeof json.timestamp === 'number' ? json.timestamp : undefined
  }
}

export function formatApiErrorMessage(status: number, body: ApiErrorBody | null): string {
  if (status === 401) return 'Missing API key. Add your key from the Creem dashboard.'
  if (status === 403) return 'Invalid API key or insufficient permissions. Check test vs production keys.'
  if (status === 429) return 'Rate limit exceeded. Try again shortly.'
  const messages = Array.isArray(body?.message) ? body.message.join('. ') : typeof body?.message === 'string' ? body.message : body?.error
  const trace = body?.trace_id ? ` (ref: ${body.trace_id.slice(0, 8)})` : ''
  return messages ? `${messages}${trace}` : `API error ${status}. Try again.${trace}`
}

export function parseApiProduct(raw: unknown): Product | null {
  if (!isRecord(raw)) return null
  const id = raw.id
  if (typeof id !== 'string' || !id.trim()) return null
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Unnamed',
    description: typeof raw.description === 'string' ? raw.description : '',
    price: parsePrice(raw.price),
    currency: typeof raw.currency === 'string' && raw.currency.trim() ? raw.currency : 'USD',
    type: parseBillingType(raw.billing_type),
    billingPeriod: parseBillingPeriod(raw.billing_period),
    status: parseStatus(raw.status),
    image_url: typeof raw.image_url === 'string' && raw.image_url.length > 0 ? raw.image_url : undefined,
    features: parseFeatures(raw.features)
  }
}

export type ProductsSearchResponse = {
  items: Product[]
  currentPage: number
  totalPages: number
  hasMore: boolean
}

export function parseProductsSearchResponse(json: unknown): ProductsSearchResponse | null {
  if (!isRecord(json)) return null
  const items = Array.isArray(json.items) ? json.items : []
  const products = items.map(parseApiProduct).filter((product): product is Product => product !== null)
  const pagination = isRecord(json.pagination) ? json.pagination : null
  const currentPage = pagination && typeof pagination.current_page === 'number' ? pagination.current_page : 1
  const totalPages = pagination && typeof pagination.total_pages === 'number' ? pagination.total_pages : 1
  const hasMore = pagination !== null && pagination.next_page !== null && pagination.next_page !== undefined && typeof pagination.next_page === 'number'
  return {
    items: products,
    currentPage,
    totalPages,
    hasMore
  }
}
