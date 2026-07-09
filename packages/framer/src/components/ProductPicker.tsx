import { Image, iconClass } from '@/icons'
import type { BillingPeriod } from '@/types'
import { formatPrice } from '@/utils/formatters'
import { cn, fitButton, selectRow } from '@/styles/ui'

// Fixed accent used only for the plugin's own UI chrome (selection indicators,
// order badges). Colors on the INSERTED components are styled via Framer's
// native property controls, not baked in here.
export const PLUGIN_ACCENT = '#FFBE98'

/**
 * Normalized row model rendered by the picker. A row can stand for a single
 * product or a monthly/yearly pair — `key` is the selection identity (product
 * id or pair base name) while `productId` is the underlying product.
 */
export type PickerItem = {
  key: string
  productId: string
  name: string
  /** Carried for tier-config creation on select — not rendered in the row. */
  description: string
  price: number | null
  currency: string
  type: 'one_time' | 'recurring'
  billingPeriod?: BillingPeriod
  image_url?: string
  badge?: string
  badgeTone?: 'pair' | 'default'
  note?: string
}

type ProductPickerProps = {
  items: PickerItem[]
  mode: 'single' | 'multi'
  /** Selected keys, in selection order (order drives the multi-select badge). */
  selection: string[]
  onSelect: (item: PickerItem) => void
}

export function ProductPicker({ items, mode, selection, onSelect }: ProductPickerProps) {
  return (
    <div className='flex flex-col gap-2' role={mode === 'single' ? 'radiogroup' : 'group'}>
      {items.map(item => {
        const selected = selection.includes(item.key)
        const order = mode === 'multi' && selected ? selection.indexOf(item.key) + 1 : null
        return <ProductRow key={item.key} item={item} mode={mode} selected={selected} order={order} onSelect={() => onSelect(item)} />
      })}
    </div>
  )
}

type ProductRowProps = {
  item: PickerItem
  mode: 'single' | 'multi'
  selected: boolean
  order: number | null
  onSelect: () => void
}

function ProductRow({ item, mode, selected, order, onSelect }: ProductRowProps) {
  return (
    // The whole row is the hit target. `selectRow` sets an explicit background,
    // which is required — a bare <button> otherwise inherits Framer's dark
    // `buttonface` system color and renders as a black bar.
    <button
      type='button'
      onClick={onSelect}
      role={mode === 'single' ? 'radio' : 'checkbox'}
      aria-checked={selected}
      className={cn(selectRow.pick(selected), fitButton, 'flex w-full items-center gap-3 px-3 py-3 text-left')}
    >
      <div className='flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-black bg-gray-100'>
        {item.image_url ? <img src={item.image_url} className='h-full w-full object-cover' alt='' /> : <Image className={iconClass('md', 'text-gray-300')} aria-hidden='true' />}
      </div>
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <div className='flex min-w-0 items-center gap-1.5'>
          <span className='truncate text-sm font-black text-black' title={item.name}>
            {item.name}
          </span>
          {order !== null && (
            <span className='shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black text-black' style={{ background: PLUGIN_ACCENT }}>
              #{order}
            </span>
          )}
        </div>
        <div className='flex min-w-0 items-center gap-1.5'>
          <span className='shrink-0 text-xs font-extrabold text-gray-700'>{formatPrice(item.price, item.currency, item.type, item.billingPeriod)}</span>
          {item.badge && (
            <span
              className={cn(
                'truncate rounded border border-black px-1 py-0.5 text-[8px] font-black text-gray-700 uppercase',
                item.badgeTone === 'pair' ? 'bg-purple-100' : 'bg-gray-100'
              )}
            >
              {item.badge}
            </span>
          )}
          {item.note && <span className='shrink-0 text-[9px] font-bold text-yellow-600'>{item.note}</span>}
        </div>
      </div>
    </button>
  )
}
