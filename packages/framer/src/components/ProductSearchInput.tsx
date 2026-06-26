import { Search, iconClass } from '@/icons'

type ProductSearchInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function ProductSearchInput({ value, onChange, placeholder = 'Search products…' }: ProductSearchInputProps) {
  return (
    <div className='relative'>
      <Search className={iconClass('xs', 'pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400')} aria-hidden='true' />
      <input
        type='search'
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className='w-full rounded-lg border border-black bg-white py-2 pr-3 pl-9 text-sm font-bold outline-none placeholder:font-semibold placeholder:text-gray-400'
        aria-label='Search products'
      />
    </div>
  )
}
