import { useMemo, useState } from 'react'
import { ArrowRight, Image, RefreshCcw, iconClass } from '@/icons'
import { badge, btn, card, cn, screen } from '@/styles/ui'
import type { Product, InsertType } from '@/types'
import { formatPrice } from '@/utils/formatters'
import { matchesProductSearch } from '@/utils/productHelpers'
import { ProductSearchInput } from '@/components/ProductSearchInput'

type ProductsScreenProps = {
  products: Product[]
  showArchived: boolean
  onShowArchivedChange: (show: boolean) => void
  testMode: boolean
  apiKey: string
  lastSyncedAt: number | null
  onClearKey: () => void
  onInsert: (type: InsertType) => void
  onProductClick: (product: Product) => void
  onRefresh: () => void
  loading: boolean
  error?: string
}

function formatSyncedAt(timestamp: number | null): string | null {
  if (!timestamp) return null
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function ProductsScreen({
  products,
  showArchived,
  onShowArchivedChange,
  lastSyncedAt,
  onClearKey,
  onInsert,
  onProductClick,
  onRefresh,
  loading,
  error
}: ProductsScreenProps) {
  const [search, setSearch] = useState('')
  const syncedLabel = formatSyncedAt(lastSyncedAt)
  const statusFiltered = showArchived ? products : products.filter(product => product.status === 'active')
  const visibleProducts = useMemo(() => statusFiltered.filter(product => matchesProductSearch(product, search)), [statusFiltered, search])
  const archivedCount = products.filter(product => product.status === 'archived').length
  return (
    <div className={screen}>
      <div className={card.header}>
        <img src='/creem.svg' alt='Creem Logo' className='block h-[18px]' />
        <button onClick={onClearKey} className={cn(btn.dark, btn.logout, 'py-2')}>
          Log out
        </button>
      </div>
      <div className='flex min-h-0 flex-1 flex-col gap-3'>
        <div className={card.panel}>
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='m-0 text-lg font-black tracking-tight'>Products</h3>
              {syncedLabel && <p className='m-0 mt-0.5 text-[10px] font-bold text-gray-500'>Synced {syncedLabel}</p>}
            </div>
            <div className='flex items-center gap-2'>
              <button onClick={onRefresh} disabled={loading} className={cn(btn.icon, 'rounded-md')} aria-label='Refresh products'>
                <RefreshCcw className={iconClass('xxs', loading && 'animate-spin')} aria-hidden='true' />
              </button>
              <div className={badge}>{visibleProducts.length}</div>
            </div>
          </div>
          <ProductSearchInput value={search} onChange={setSearch} />
          <label className='flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-black bg-gray-50 px-3 py-2'>
            <span className='text-xs font-bold text-gray-700'>Show archived products</span>
            <input type='checkbox' checked={showArchived} onChange={e => onShowArchivedChange(e.target.checked)} className='h-4 w-4' aria-label='Show archived products' />
          </label>
          {error && <div className='rounded-lg border-2 border-red-400 bg-red-50 px-3 py-2 text-xs font-bold text-red-800'>{error}</div>}
          <div className='-mx-1 flex flex-1 flex-col gap-2.5 overflow-x-hidden overflow-y-auto px-1 pt-1' role='list'>
            {visibleProducts.length === 0 ? (
              <div className='py-8 text-center text-sm font-bold text-gray-500'>
                {loading
                  ? 'Loading products…'
                  : search.trim()
                    ? `No products match "${search.trim()}".`
                    : showArchived
                      ? 'No products found.'
                      : archivedCount > 0
                        ? 'No active products. Enable archived to view archived products.'
                        : 'No active products found.'}
              </div>
            ) : (
              visibleProducts.map(product => (
                <div key={product.id} onClick={() => onProductClick(product)} className={cn(card.interactive, 'gap-3')}>
                  <div className='flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-black bg-gray-100'>
                    {product.image_url ? (
                      <img src={product.image_url} className='h-full w-full object-cover' alt='' />
                    ) : (
                      <Image className={iconClass('lg', 'text-gray-300')} aria-hidden='true' />
                    )}
                  </div>
                  <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                    <div className='flex min-w-0 items-center gap-1.5'>
                      <div className='truncate text-sm leading-tight font-black' title={product.name}>
                        {product.name}
                      </div>
                      {product.status === 'archived' && (
                        <span className='shrink-0 rounded border border-black bg-gray-200 px-1.5 py-0.5 text-[9px] font-black uppercase'>Archived</span>
                      )}
                    </div>
                    <div className='text-xs font-extrabold text-gray-600'>{formatPrice(product.price, product.currency, product.type, product.billingPeriod)}</div>
                  </div>
                  <ArrowRight className={iconClass('md')} aria-hidden='true' />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className='flex shrink-0 flex-col gap-2'>
        <button onClick={() => onInsert('button')} className={cn(btn.cta, 'text-sm')}>
          Insert Button &rarr;
        </button>
        <button onClick={() => onInsert('pricing')} className={cn(btn.cta, 'text-sm')}>
          Insert Pricing Table &rarr;
        </button>
      </div>
    </div>
  )
}
