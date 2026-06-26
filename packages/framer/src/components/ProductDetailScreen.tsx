import { ArrowLeft, iconClass } from '@/icons'
import { btn, card, cn, screen } from '@/styles/ui'
import type { Product } from '@/types'
import { formatPrice } from '@/utils/formatters'
import { Markdown } from '@/components/Markdown'

type ProductDetailScreenProps = {
  product: Product
  onBack: () => void
  onSelect: () => void
}

export function ProductDetailScreen({ product, onBack, onSelect }: ProductDetailScreenProps) {
  return (
    <div className={screen}>
      <button onClick={onBack} className={cn(btn.compact, 'w-fit px-2.5 py-1.5 text-xs')}>
        <ArrowLeft className={iconClass('sm')} aria-hidden='true' />
        BACK
      </button>
      <div className={cn(card.panel, 'gap-4 overflow-hidden')}>
        {product.image_url && (
          <div className='flex aspect-square h-[200px] w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-black bg-gray-50'>
            <img src={product.image_url} className='h-full w-full object-cover' alt={product.name} />
          </div>
        )}
        <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto'>
          <div className='flex items-start justify-between gap-2.5'>
            <div className='flex min-w-0 flex-1 flex-col gap-1'>
              <h2 className='m-0 text-xl leading-tight font-black'>{product.name}</h2>
              {product.status === 'archived' && <span className='w-fit rounded border border-black bg-gray-200 px-1.5 py-0.5 text-[10px] font-black uppercase'>Archived</span>}
            </div>
            <div className='border-creem-ink bg-creem-ink shrink-0 rounded-lg border-2 px-2 py-1 text-sm font-black whitespace-nowrap text-white'>
              {formatPrice(product.price, product.currency, product.type, product.billingPeriod)}
            </div>
          </div>
          {product.description && <Markdown text={product.description} className='min-w-0 text-sm font-semibold break-words text-gray-600' />}
        </div>
        <div className='flex shrink-0 flex-col gap-2.5'>
          {product.status === 'archived' ? (
            <div className='rounded-xl border-2 border-dashed border-gray-400 bg-gray-50 px-4 py-4 text-center text-sm font-bold text-gray-500'>
              Archived products cannot be inserted into Framer.
            </div>
          ) : (
            <button onClick={onSelect} className={cn(btn.cta, 'py-4 text-base')}>
              Add Buy Button
            </button>
          )}
          <div className='text-center text-[10px] font-bold text-gray-500'>PRODUCT ID: {product.id}</div>
        </div>
      </div>
    </div>
  )
}
