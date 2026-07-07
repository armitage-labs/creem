import { useState, useCallback, useMemo, useEffect } from 'react'
import { framer } from '@framer/plugin'
import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, ChevronUp, Info, Loader2, Plus, Trash2, iconClass } from '@/icons'
import type { Product, InsertType, CheckoutType, PricingInterval, PricingLayout, GridColumns, TierConfig } from '@/types'
import { formatPrice } from '@/utils/formatters'
import { getProductPairs, getUnpairedProducts, getIndividualPricingProducts, getBillingPeriodPairSlot, matchesProductSearch } from '@/utils/productHelpers'
import { ensureComponentInsertURL, withFramerIcons } from '@/utils/codeFileHelpers'
import { btn, card, cn, screen, selectRow, toggle } from '@/styles/ui'
import BUTTON_COMPONENT_SOURCE from '@/framer/checkout-button.tsx?raw'
import PRICING_TABLE_COMPONENT_SOURCE from '@/framer/pricing-table.tsx?raw'
import { ProductSearchInput } from '@/components/ProductSearchInput'

const DEFAULTS = {
  ACCENT_COLOR: '#FFBE98',
  BUTTON_TEXT: 'Buy Now',
  PRICING_INTERVAL: 'monthly' as const,
  PRICING_LAYOUT: 'grid' as const,
  GRID_COLUMNS: 3 as const,
  FEATURES_TITLE: 'Features',
  CTA_TEXT: 'Get Started',
  HEADER_TITLE: 'Choose your plan',
  HEADER_DESCRIPTION: 'Select the plan that works best for you.',
  PRIMARY_BUTTON_TEXT: '#FFFFFF',
  SECONDARY_BUTTON_BG: '#EDEDED',
  SECONDARY_BUTTON_TEXT: '#000000',
  BUTTON_BORDER: '#E1E1E1',
  CTA_BACKGROUND: '#000000',
  CTA_TEXT_COLOR: '#FFFFFF'
}

const DEFAULT_FEATURES = ['All features included', 'Priority support']

const PRICING_LIMITS = {
  MIN_TIERS: 1
}

type InsertScreenProps = {
  insertType: InsertType
  setInsertType: React.Dispatch<React.SetStateAction<InsertType>>
  products: Product[]
  testMode: boolean
  checkoutType: CheckoutType
  setCheckoutType: React.Dispatch<React.SetStateAction<CheckoutType>>
  initialProductId?: string | null
  onBack: () => void
}

function createTierConfig(key: string, name: string, description: string, apiFeatures?: string[]): TierConfig {
  const features = apiFeatures && apiFeatures.length > 0 ? apiFeatures : [`${name} access`, ...DEFAULT_FEATURES]
  return {
    key,
    name,
    description: description || `Perfect for ${name.toLowerCase()} users`,
    features,
    featuresTitle: DEFAULTS.FEATURES_TITLE,
    ctaText: DEFAULTS.CTA_TEXT,
    highlighted: false
  }
}

function tierCtaControls(config: TierConfig) {
  const customBackground = config.ctaBackground?.trim()
  const customTextColor = config.ctaTextColor?.trim()
  return {
    ctaBackground: customBackground || DEFAULTS.CTA_BACKGROUND,
    ctaTextColor: customTextColor || DEFAULTS.CTA_TEXT_COLOR
  }
}

export function InsertScreen({ insertType, setInsertType, products, testMode, checkoutType, setCheckoutType, initialProductId, onBack }: InsertScreenProps) {
  const [selectedId, setSelectedId] = useState<string>(() => initialProductId ?? products[0]?.id ?? '')
  const [buttonText, setButtonText] = useState<string>(DEFAULTS.BUTTON_TEXT)
  const [accentColor, setAccentColor] = useState<string>(DEFAULTS.ACCENT_COLOR)
  const [inserting, setInserting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [pricingInterval, setPricingInterval] = useState<PricingInterval>(DEFAULTS.PRICING_INTERVAL)
  const [pricingLayout, setPricingLayout] = useState<PricingLayout>(DEFAULTS.PRICING_LAYOUT)
  const [gridColumns, setGridColumns] = useState<GridColumns>(DEFAULTS.GRID_COLUMNS)
  const [headerTitle, setHeaderTitle] = useState(DEFAULTS.HEADER_TITLE)
  const [headerDescription, setHeaderDescription] = useState(DEFAULTS.HEADER_DESCRIPTION)
  const [tierConfigs, setTierConfigs] = useState<Record<string, TierConfig>>({})
  const [editingTierKey, setEditingTierKey] = useState<string | null>(null)
  const productPairs = getProductPairs(products)
  const unpairedProducts = getUnpairedProducts(products)
  const individualProducts = getIndividualPricingProducts(products)
  const hasPairSelections = selectedProducts.some(id => productPairs.some(pair => pair.baseName === id))
  const upsertTierConfig = useCallback((key: string, name: string, description: string, apiFeatures?: string[]) => {
    setTierConfigs(prev => {
      if (prev[key]) return prev
      return { ...prev, [key]: createTierConfig(key, name, description, apiFeatures) }
    })
  }, [])
  const removeTierConfig = useCallback((key: string) => {
    setTierConfigs(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setEditingTierKey(current => (current === key ? null : current))
  }, [])
  const updateTierConfig = useCallback((key: string, patch: Partial<TierConfig>) => {
    setTierConfigs(prev => ({
      ...prev,
      [key]: { ...prev[key], ...patch }
    }))
  }, [])
  const toggleProduct = (id: string, name: string, description: string, apiFeatures?: string[]) => {
    setSelectedProducts(prev => {
      if (prev.includes(id)) {
        removeTierConfig(id)
        return prev.filter(p => p !== id)
      }
      upsertTierConfig(id, name, description, apiFeatures)
      return [...prev, id]
    })
  }
  const moveProduct = (fromIndex: number, toIndex: number) => {
    setSelectedProducts(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }
  useEffect(() => {
    setEditingTierKey(prev => {
      if (selectedProducts.length === 0) return null
      if (prev && selectedProducts.includes(prev)) return prev
      return selectedProducts[0]
    })
  }, [selectedProducts])
  const handleInsert = useCallback(async () => {
    if (insertType === 'button' && !selectedId) {
      framer.notify('Please select a product from the dropdown', { variant: 'error' })
      return
    }
    if (insertType === 'pricing' && selectedProducts.length < PRICING_LIMITS.MIN_TIERS) {
      framer.notify('Please select at least 1 product for the pricing table', { variant: 'error' })
      return
    }
    setInserting(true)
    try {
      if (insertType === 'button') {
        const insertURL = await ensureComponentInsertURL('CreemCheckoutButton.tsx', withFramerIcons(BUTTON_COMPONENT_SOURCE))
        if (!insertURL) {
          framer.notify('CreemCheckoutButton.tsx is still compiling. Try inserting again in a moment.', {
            variant: 'error'
          })
          setInserting(false)
          return
        }
        await framer.addComponentInstance({
          url: insertURL,
          attributes: {
            controls: {
              productId: selectedId,
              buttonText,
              backgroundColor: accentColor,
              testMode,
              type: checkoutType === 'embed' ? 'Embed' : 'New Tab',
              linkTarget: '_blank'
            }
          }
        })
        framer.notify('Checkout button inserted!', { variant: 'success' })
      } else {
        const insertURL = await ensureComponentInsertURL('CreemPricingTable.tsx', withFramerIcons(PRICING_TABLE_COMPONENT_SOURCE))
        if (!insertURL) {
          framer.notify('CreemPricingTable.tsx is still compiling. Try inserting again in a moment.', {
            variant: 'error'
          })
          setInserting(false)
          return
        }
        const tiers = selectedProducts.map(selectionId => {
          const pair = productPairs.find(p => p.baseName === selectionId)
          if (pair) {
            const monthlyProduct = pair.monthly
            const yearlyProduct = pair.yearly
            const baseProduct = monthlyProduct || yearlyProduct!
            const config = tierConfigs[selectionId] ?? createTierConfig(selectionId, selectionId, baseProduct.description)
            return {
              name: config.name,
              monthlyPriceCents: monthlyProduct?.price ?? null,
              yearlyPriceCents: yearlyProduct?.price ?? null,
              monthlyPrice: (monthlyProduct?.price ?? 0) / 100,
              yearlyPrice: (yearlyProduct?.price ?? 0) / 100,
              currency: baseProduct.currency,
              description: config.description,
              features: config.features,
              featuresTitle: config.featuresTitle,
              productId: baseProduct.id,
              monthlyProductId: monthlyProduct?.id || '',
              yearlyProductId: yearlyProduct?.id || '',
              ctaText: config.ctaText,
              ...tierCtaControls(config),
              highlighted: config.highlighted,
              isOneTime: false
            }
          }
          const p = products.find(prod => prod.id === selectionId)!
          const config = tierConfigs[selectionId] ?? createTierConfig(selectionId, p.name, p.description)
          const isOneTime = p.type === 'one_time'
          let monthlyProductId = ''
          let yearlyProductId = ''
          if (!isOneTime) {
            const slot = getBillingPeriodPairSlot(p.billingPeriod)
            if (slot === 'monthly') monthlyProductId = p.id
            else if (slot === 'yearly') yearlyProductId = p.id
          }
          return {
            name: config.name,
            monthlyPriceCents: p.price,
            yearlyPriceCents: p.price,
            monthlyPrice: (p.price ?? 0) / 100,
            yearlyPrice: (p.price ?? 0) / 100,
            currency: p.currency,
            billingPeriod: isOneTime ? 'once' : p.billingPeriod || 'every-month',
            description: config.description,
            features: config.features,
            featuresTitle: config.featuresTitle,
            productId: p.id,
            monthlyProductId,
            yearlyProductId,
            ctaText: config.ctaText,
            ...tierCtaControls(config),
            highlighted: config.highlighted,
            isOneTime
          }
        })
        await framer.addComponentInstance({
          url: insertURL,
          attributes: {
            controls: {
              tiers,
              type: checkoutType,
              layout: pricingLayout,
              gridColumns: pricingLayout === 'grid' ? gridColumns : undefined,
              showHeader: !!(headerTitle.trim() || headerDescription.trim()),
              headerTitle: headerTitle.trim(),
              headerDescription: headerDescription.trim(),
              accentColor,
              primaryButtonBackground: accentColor,
              primaryButtonTextColor: DEFAULTS.PRIMARY_BUTTON_TEXT,
              secondaryButtonBackground: DEFAULTS.SECONDARY_BUTTON_BG,
              secondaryButtonTextColor: DEFAULTS.SECONDARY_BUTTON_TEXT,
              buttonBorderColor: DEFAULTS.BUTTON_BORDER,
              featuredBorderColor: accentColor,
              toggleActiveBackground: accentColor,
              testMode,
              showYearlyToggle: hasPairSelections
            }
          }
        })
        framer.notify('Pricing table inserted with your products!', { variant: 'success' })
      }
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setInserting(false)
      }, 2000)
    } catch (err) {
      console.error('Failed to insert:', err)
      framer.notify(`Insert failed: ${(err as Error).message}`, { variant: 'error' })
      setInserting(false)
    }
  }, [
    insertType,
    selectedId,
    buttonText,
    accentColor,
    checkoutType,
    testMode,
    selectedProducts,
    products,
    productPairs,
    hasPairSelections,
    tierConfigs,
    pricingLayout,
    gridColumns,
    headerTitle,
    headerDescription
  ])
  const selectedProduct = products.find(p => p.id === selectedId)
  return (
    <div className={cn(screen, 'min-w-0')}>
      <div className={cn(card.header, 'relative justify-center')}>
        <button onClick={onBack} className={cn(btn.compact, btn.iconSize, 'absolute left-3')} aria-label='Go back'>
          <ArrowLeft className={iconClass('btn')} />
        </button>
        <span className='text-sm font-black tracking-tight'>{insertType === 'button' ? 'Checkout Button' : 'Pricing Table'}</span>
      </div>
      <div className={cn(card.inset, 'gap-2 p-2')} role='tablist'>
        <button
          className={cn('flex-1 rounded-lg px-3 py-2.5 text-xs font-black', toggle.segment(insertType === 'button'))}
          onClick={() => setInsertType('button')}
          role='tab'
          aria-selected={insertType === 'button'}
        >
          Button
        </button>
        <button
          className={cn('flex-1 rounded-lg px-3 py-2.5 text-xs font-black', toggle.segment(insertType === 'pricing'))}
          onClick={() => setInsertType('pricing')}
          role='tab'
          aria-selected={insertType === 'pricing'}
        >
          Pricing Table
        </button>
      </div>
      {insertType === 'button' ? (
        <ButtonConfiguration
          products={products}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          buttonText={buttonText}
          setButtonText={setButtonText}
          checkoutType={checkoutType}
          setCheckoutType={setCheckoutType}
          accentColor={accentColor}
          setAccentColor={setAccentColor}
          selectedProduct={selectedProduct}
        />
      ) : (
        <PricingConfiguration
          products={products}
          productPairs={productPairs}
          unpairedProducts={unpairedProducts}
          individualProducts={individualProducts}
          pricingInterval={pricingInterval}
          setPricingInterval={setPricingInterval}
          pricingLayout={pricingLayout}
          setPricingLayout={setPricingLayout}
          gridColumns={gridColumns}
          setGridColumns={setGridColumns}
          headerTitle={headerTitle}
          setHeaderTitle={setHeaderTitle}
          headerDescription={headerDescription}
          setHeaderDescription={setHeaderDescription}
          checkoutType={checkoutType}
          setCheckoutType={setCheckoutType}
          selectedProducts={selectedProducts}
          toggleProduct={toggleProduct}
          moveProduct={moveProduct}
          accentColor={accentColor}
          setAccentColor={setAccentColor}
          tierConfigs={tierConfigs}
          editingTierKey={editingTierKey}
          setEditingTierKey={setEditingTierKey}
          updateTierConfig={updateTierConfig}
        />
      )}
      <button
        className={cn(btn.cta, 'shrink-0 text-sm tracking-tight')}
        onClick={handleInsert}
        disabled={inserting || success || (insertType === 'button' && !selectedId) || (insertType === 'pricing' && selectedProducts.length < 1)}
        aria-busy={inserting}
      >
        {success ? (
          <>
            <Check className={iconClass('sm')} /> Inserted!
          </>
        ) : inserting ? (
          <>
            <Loader2 className={iconClass('sm', 'animate-spin')} /> Inserting…
          </>
        ) : (
          `Insert ${insertType === 'button' ? 'Button' : 'Pricing Table'}`
        )}
      </button>
    </div>
  )
}

type ButtonConfigurationProps = {
  products: Product[]
  selectedId: string
  setSelectedId: React.Dispatch<React.SetStateAction<string>>
  buttonText: string
  setButtonText: React.Dispatch<React.SetStateAction<string>>
  checkoutType: CheckoutType
  setCheckoutType: React.Dispatch<React.SetStateAction<CheckoutType>>
  accentColor: string
  setAccentColor: React.Dispatch<React.SetStateAction<string>>
  selectedProduct: Product | undefined
}

function ButtonConfiguration({
  products,
  selectedId,
  setSelectedId,
  buttonText,
  setButtonText,
  checkoutType,
  setCheckoutType,
  accentColor,
  setAccentColor,
  selectedProduct
}: ButtonConfigurationProps) {
  const [search, setSearch] = useState('')
  const filteredProducts = useMemo(() => {
    const matching = products.filter(p => matchesProductSearch(p, search))
    if (!selectedId || matching.some(p => p.id === selectedId)) return matching
    const selected = products.find(p => p.id === selectedId)
    return selected ? [selected, ...matching] : matching
  }, [products, search, selectedId])

  return (
    <div className='flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 overflow-y-auto'>
      <div className='flex flex-col gap-2 rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]'>
        <label className='text-[10px] font-black tracking-wider text-gray-600 uppercase'>Product</label>
        <ProductSearchInput value={search} onChange={setSearch} />
        <select
          className='w-full shrink-0 cursor-pointer appearance-none rounded-lg border-2 border-black bg-white px-3 py-2.5 text-sm leading-normal font-bold text-black outline-none'
          style={{ minHeight: 44, lineHeight: 1.4 }}
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          aria-label='Select product'
        >
          <option value=''>Select your product</option>
          {filteredProducts.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} - {formatPrice(p.price, p.currency, p.type, p.billingPeriod)}
            </option>
          ))}
        </select>
        {search.trim() && filteredProducts.length === 0 && <p className='text-xs font-bold text-gray-500'>No products match &ldquo;{search.trim()}&rdquo;.</p>}
      </div>
      <CheckoutTypeSelector checkoutType={checkoutType} setCheckoutType={setCheckoutType} />
      <div className='flex flex-col gap-2 rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]'>
        <label className='text-[10px] font-black tracking-wider text-gray-600 uppercase'>Button Text</label>
        <input
          className='w-full rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-black outline-none placeholder:text-gray-400'
          value={buttonText}
          style={{ border: '1px solid #000' }}
          onChange={e => setButtonText(e.target.value)}
          placeholder='Buy Now'
        />
      </div>
      <AccentColorPicker accentColor={accentColor} setAccentColor={setAccentColor} />
      {selectedProduct && (
        <div className='flex flex-col items-center gap-3 rounded-xl border-2 border-black bg-white p-4 shadow-[3px_3px_0px_0px_#000]'>
          <p className='self-start text-[10px] font-black tracking-wider text-gray-600 uppercase'>Preview</p>
          <button className='cursor-default rounded-lg border-none px-6 py-3 text-sm font-semibold tracking-tight text-white' style={{ backgroundColor: accentColor }}>
            {buttonText || 'Buy Now'}
          </button>
          <p className='text-center text-[10px] font-bold break-all text-gray-500'>
            Product ID: <code className='font-mono text-black'>{selectedId}</code>
          </p>
        </div>
      )}
    </div>
  )
}

type PricingConfigurationProps = {
  products: Product[]
  productPairs: ReturnType<typeof getProductPairs>
  unpairedProducts: ReturnType<typeof getUnpairedProducts>
  individualProducts: Product[]
  pricingInterval: PricingInterval
  setPricingInterval: React.Dispatch<React.SetStateAction<PricingInterval>>
  pricingLayout: PricingLayout
  setPricingLayout: React.Dispatch<React.SetStateAction<PricingLayout>>
  gridColumns: GridColumns
  setGridColumns: React.Dispatch<React.SetStateAction<GridColumns>>
  headerTitle: string
  setHeaderTitle: React.Dispatch<React.SetStateAction<string>>
  headerDescription: string
  setHeaderDescription: React.Dispatch<React.SetStateAction<string>>
  checkoutType: CheckoutType
  setCheckoutType: React.Dispatch<React.SetStateAction<CheckoutType>>
  selectedProducts: string[]
  toggleProduct: (id: string, name: string, description: string, apiFeatures?: string[]) => void
  moveProduct: (from: number, to: number) => void
  accentColor: string
  setAccentColor: React.Dispatch<React.SetStateAction<string>>
  tierConfigs: Record<string, TierConfig>
  editingTierKey: string | null
  setEditingTierKey: React.Dispatch<React.SetStateAction<string | null>>
  updateTierConfig: (key: string, patch: Partial<TierConfig>) => void
}

function PricingConfiguration({
  products,
  productPairs,
  unpairedProducts,
  individualProducts,
  pricingInterval,
  setPricingInterval,
  pricingLayout,
  setPricingLayout,
  gridColumns,
  setGridColumns,
  headerTitle,
  setHeaderTitle,
  headerDescription,
  setHeaderDescription,
  checkoutType,
  setCheckoutType,
  selectedProducts,
  toggleProduct,
  moveProduct,
  accentColor,
  setAccentColor: _setAccentColor,
  tierConfigs,
  editingTierKey,
  setEditingTierKey,
  updateTierConfig
}: PricingConfigurationProps) {
  const [search, setSearch] = useState('')
  const searchedPairs = useMemo(
    () =>
      productPairs.filter(pair => {
        const product = pair.monthly ?? pair.yearly
        if (!product) return false
        const q = search.trim().toLowerCase()
        if (!q) return true
        return pair.baseName.toLowerCase().includes(q) || matchesProductSearch(product, search)
      }),
    [productPairs, search]
  )
  const searchedProducts = useMemo(() => individualProducts.filter(p => matchesProductSearch(p, search)), [individualProducts, search])
  const resolveSelectionName = (selectionId: string) =>
    tierConfigs[selectionId]?.name ?? productPairs.find(pair => pair.baseName === selectionId)?.baseName ?? products.find(p => p.id === selectionId)?.name ?? 'Unknown'

  return (
    <div className='flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 overflow-y-auto'>
      <div className='flex w-full min-w-0 flex-col gap-2 rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]'>
        <label className='text-[10px] font-black tracking-wider text-gray-600 uppercase'>Heading</label>
        <input
          className='w-full rounded-lg border border-black bg-white px-3 py-2.5 text-sm font-bold text-black outline-none placeholder:text-gray-400'
          value={headerTitle}
          onChange={e => setHeaderTitle(e.target.value)}
          placeholder='Choose your plan'
        />
        <label className='text-[10px] font-black tracking-wider text-gray-600 uppercase'>Subheading</label>
        <textarea
          className='min-h-[72px] w-full rounded-lg border border-black bg-white px-3 py-2.5 text-sm font-semibold text-black outline-none placeholder:text-gray-400'
          value={headerDescription}
          onChange={e => setHeaderDescription(e.target.value)}
          placeholder='Select the plan that works best for you.'
        />
      </div>
      <div className='flex w-full min-w-0 flex-col gap-2 rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]'>
        <label className='text-[10px] font-black tracking-wider text-gray-600 uppercase'>Layout</label>
        <div className='flex gap-2'>
          {(['grid', 'horizontal', 'vertical'] as PricingLayout[]).map(layout => (
            <button
              key={layout}
              className={cn('flex-1 rounded-lg px-2 py-2 text-[10px] font-black capitalize', toggle.segment(pricingLayout === layout))}
              onClick={() => setPricingLayout(layout)}
            >
              {layout}
            </button>
          ))}
        </div>
        {pricingLayout === 'grid' && (
          <div className='flex flex-col gap-2 border-t border-gray-200 pt-2'>
            <label className='text-[10px] font-black tracking-wider text-gray-600 uppercase'>Columns</label>
            <div className='flex gap-2'>
              {([1, 2, 3, 4, 5] as GridColumns[]).map(columns => (
                <button
                  key={columns}
                  className={cn('flex-1 rounded-lg px-2 py-2 text-[10px] font-black', toggle.segment(gridColumns === columns))}
                  onClick={() => setGridColumns(columns)}
                >
                  {columns}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <CheckoutTypeSelector checkoutType={checkoutType} setCheckoutType={setCheckoutType} />
      <div className='flex flex-col gap-2 rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]'>
        <label className='text-[10px] font-black tracking-wider text-gray-600 uppercase'>Select Products ({selectedProducts.length} selected)</label>
        {productPairs.length > 0 && (
          <div className='mb-1 flex items-center gap-2'>
            <button className={cn('flex-1 rounded-lg px-3 py-2 text-xs font-black', toggle.segment(pricingInterval === 'monthly'))} onClick={() => setPricingInterval('monthly')}>
              Monthly
            </button>
            <button className={cn('flex-1 rounded-lg px-3 py-2 text-xs font-black', toggle.segment(pricingInterval === 'yearly'))} onClick={() => setPricingInterval('yearly')}>
              Yearly
            </button>
          </div>
        )}
        <ProductSearchInput value={search} onChange={setSearch} />
        {products.length === 0 ? (
          <div className='flex items-center gap-2.5 rounded-lg border-2 border-yellow-500 bg-yellow-100 px-3 py-3 text-xs leading-relaxed font-bold text-yellow-900'>
            <Info className={iconClass('sm', 'shrink-0')} />
            <p>No products found. Add products in your Creem dashboard.</p>
          </div>
        ) : search.trim() && searchedPairs.length === 0 && searchedProducts.length === 0 ? (
          <p className='py-4 text-center text-xs font-bold text-gray-500'>No products match &ldquo;{search.trim()}&rdquo;.</p>
        ) : (
          <>
            {unpairedProducts.length > 0 && productPairs.length > 0 && (
              <div className='flex flex-col gap-2 rounded-lg border-2 border-amber-500 bg-amber-50 p-3'>
                <div className='flex items-start gap-2'>
                  <Info className={iconClass('xs', 'mt-0.5 shrink-0 text-amber-700')} />
                  <p className='text-[10px] leading-relaxed font-semibold text-amber-800'>
                    Some subscription products are missing a monthly or yearly pair and appear individually below.
                  </p>
                </div>
              </div>
            )}
            <div className='flex flex-col gap-2' role='list'>
              {searchedPairs.map(pair => {
                const isSelected = selectedProducts.includes(pair.baseName)
                const selectedIndex = selectedProducts.indexOf(pair.baseName)
                const displayProduct = pricingInterval === 'monthly' ? pair.monthly : pair.yearly
                const fallbackProduct = pair.monthly ?? pair.yearly
                const product = displayProduct ?? fallbackProduct!
                const hasInterval = pricingInterval === 'monthly' ? pair.hasMonthly : pair.hasYearly
                return (
                  <div
                    key={pair.baseName}
                    className={cn('flex items-center gap-2.5 rounded-lg px-3 py-2.5', selectRow.pick(isSelected))}
                    onClick={() => toggleProduct(pair.baseName, pair.baseName, product.description, product.features)}
                    role='listitem'
                  >
                    <input type='checkbox' checked={isSelected} readOnly className='h-4 w-4' style={{ accentColor }} />
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <span className='truncate text-sm font-black text-black'>{pair.baseName}</span>
                        <span className='shrink-0 rounded border border-black bg-purple-100 px-1.5 py-0.5 text-[9px] font-black uppercase'>Monthly + Yearly</span>
                        {isSelected && (
                          <span className='rounded px-1.5 py-0.5 text-[10px] font-black text-white' style={{ background: accentColor }}>
                            #{selectedIndex + 1}
                          </span>
                        )}
                      </div>
                      <div className='flex items-center gap-1.5'>
                        {!hasInterval && <span className='text-[9px] font-bold text-yellow-600'>Only {pricingInterval === 'monthly' ? 'yearly' : 'monthly'}</span>}
                        <span className='text-xs font-bold text-gray-600'>{formatPrice(product.price, product.currency, product.type, product.billingPeriod)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {searchedProducts.map(p => {
                const isSelected = selectedProducts.includes(p.id)
                const selectedIndex = selectedProducts.indexOf(p.id)
                return (
                  <div
                    key={p.id}
                    className={cn('flex items-center gap-2.5 rounded-lg px-3 py-2.5', selectRow.pick(isSelected))}
                    onClick={() => toggleProduct(p.id, p.name, p.description, p.features)}
                    role='listitem'
                  >
                    <input type='checkbox' checked={isSelected} readOnly className='h-4 w-4' style={{ accentColor }} />
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <span className='truncate text-sm font-black text-black'>{p.name}</span>
                        <span className='shrink-0 rounded border border-black bg-gray-100 px-1.5 py-0.5 text-[9px] font-black uppercase'>
                          {p.type === 'one_time' ? 'One-time' : 'Subscription'}
                        </span>
                        {isSelected && (
                          <span className='rounded px-1.5 py-0.5 text-[10px] font-black text-white' style={{ background: accentColor }}>
                            #{selectedIndex + 1}
                          </span>
                        )}
                      </div>
                      <span className='text-xs font-bold text-gray-600'>{formatPrice(p.price, p.currency, p.type, p.billingPeriod)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      {selectedProducts.length > 1 && (
        <div className='flex flex-col gap-2 rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]'>
          <label className='text-[10px] font-black tracking-wider text-gray-600 uppercase'>Order (Left to Right)</label>
          <div className='flex flex-col gap-1.5'>
            {selectedProducts.map((id, i) => {
              const displayName = resolveSelectionName(id)
              return (
                <div key={id} className='flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-3 py-2'>
                  <span className='w-5 text-xs font-black text-gray-600'>#{i + 1}</span>
                  <span className='flex-1 truncate text-sm font-bold text-black'>{displayName}</span>
                  <div className='flex gap-1'>
                    <button className={cn(btn.secondary, btn.iconSize)} onClick={() => moveProduct(i, i - 1)} disabled={i === 0} aria-label='Move up'>
                      <ArrowUp className={iconClass('btn')} />
                    </button>
                    <button className={cn(btn.secondary, btn.iconSize)} onClick={() => moveProduct(i, i + 1)} disabled={i === selectedProducts.length - 1} aria-label='Move down'>
                      <ArrowDown className={iconClass('btn')} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {selectedProducts.length > 0 && (
        <div className='flex w-full min-w-0 flex-col gap-2 rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]'>
          <label className='text-[10px] font-black tracking-wider text-gray-600 uppercase'>Edit Tiers</label>
          <div className='flex w-full flex-col gap-2'>
            {selectedProducts.map(key => {
              const config = tierConfigs[key]
              if (!config) return null
              const isOpen = editingTierKey === key
              return (
                <div key={key} className='w-full rounded-lg border-2 border-gray-300 bg-gray-50'>
                  <button className={cn(btn.disclosure, 'px-3 py-2.5 text-left text-sm font-black')} onClick={() => setEditingTierKey(isOpen ? null : key)}>
                    <span className='truncate'>{config.name}</span>
                    <span className='text-xs text-gray-500'>{isOpen ? <ChevronUp className={iconClass('xs')} /> : <ChevronDown className={iconClass('xs')} />}</span>
                  </button>
                  {isOpen && (
                    <div className='flex w-full flex-col gap-2 border-t border-gray-300 px-3 py-3'>
                      <label className='text-[10px] font-black text-gray-600 uppercase'>Tier Name</label>
                      <input
                        className='w-full rounded-lg border border-black bg-white px-3 py-2 text-sm font-bold'
                        value={config.name}
                        onChange={e => updateTierConfig(key, { name: e.target.value })}
                      />
                      <label className='text-[10px] font-black text-gray-600 uppercase'>Description</label>
                      <textarea
                        className='min-h-[72px] w-full resize-y rounded-lg border border-black bg-white px-3 py-2 text-sm font-semibold'
                        value={config.description}
                        onChange={e => updateTierConfig(key, { description: e.target.value })}
                      />
                      <label className='text-[10px] font-black text-gray-600 uppercase'>CTA Text</label>
                      <input
                        className='w-full rounded-lg border border-black bg-white px-3 py-2 text-sm font-bold'
                        value={config.ctaText}
                        onChange={e => updateTierConfig(key, { ctaText: e.target.value })}
                      />
                      <TierColorField
                        label='CTA Color'
                        value={config.ctaBackground}
                        fallbackColor={DEFAULTS.CTA_BACKGROUND}
                        onChange={color => updateTierConfig(key, { ctaBackground: color })}
                        onReset={() => updateTierConfig(key, { ctaBackground: undefined })}
                        pickerAriaLabel='CTA color picker'
                      />
                      <TierColorField
                        label='CTA Text Color'
                        value={config.ctaTextColor}
                        fallbackColor={DEFAULTS.CTA_TEXT_COLOR}
                        onChange={color => updateTierConfig(key, { ctaTextColor: color })}
                        onReset={() => updateTierConfig(key, { ctaTextColor: undefined })}
                        pickerAriaLabel='CTA text color picker'
                      />
                      <label className='text-[10px] font-black text-gray-600 uppercase'>Features Title</label>
                      <input
                        className='w-full rounded-lg border border-black bg-white px-3 py-2 text-sm font-bold'
                        value={config.featuresTitle}
                        onChange={e => updateTierConfig(key, { featuresTitle: e.target.value })}
                      />
                      <label className='text-[10px] font-black text-gray-600 uppercase'>Benefits</label>
                      <div className='flex w-full flex-col gap-1.5'>
                        {config.features.map((feature, featureIndex) => (
                          <div key={featureIndex} className='flex w-full items-center gap-1.5'>
                            <input
                              className='min-w-0 flex-1 rounded-lg border border-black bg-white px-3 py-2 text-sm font-semibold'
                              value={feature}
                              onChange={e => {
                                const next = [...config.features]
                                next[featureIndex] = e.target.value
                                updateTierConfig(key, { features: next })
                              }}
                            />
                            <button
                              className={cn(btn.danger, btn.iconSizeLg)}
                              onClick={() => {
                                if (config.features.length <= 1) return
                                updateTierConfig(key, {
                                  features: config.features.filter((_, i) => i !== featureIndex)
                                })
                              }}
                              disabled={config.features.length <= 1}
                              aria-label='Remove benefit'
                            >
                              <Trash2 className={iconClass('btnLg')} />
                            </button>
                          </div>
                        ))}
                        <button className={cn(btn.dashed, 'px-3 py-2 text-xs')} onClick={() => updateTierConfig(key, { features: [...config.features, 'New benefit'] })}>
                          <Plus className={iconClass('xs')} /> Add benefit
                        </button>
                      </div>
                      <label className='text-md mt-2 flex items-center gap-2 font-bold'>
                        <input
                          type='checkbox'
                          className='size-[14px]'
                          style={{ accentColor }}
                          checked={config.highlighted}
                          onChange={e => updateTierConfig(key, { highlighted: e.target.checked })}
                        />
                        <span>Highlight this tier</span>
                      </label>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function CheckoutTypeSelector({ checkoutType, setCheckoutType }: { checkoutType: CheckoutType; setCheckoutType: React.Dispatch<React.SetStateAction<CheckoutType>> }) {
  return (
    <div className='flex flex-col gap-2 rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]'>
      <label className='text-[10px] font-black tracking-wider text-gray-600 uppercase'>Checkout Type</label>
      <div className='flex gap-2'>
        <button className={cn('flex-1 rounded-lg px-3 py-2 text-xs font-black', toggle.segment(checkoutType === 'embed'))} onClick={() => setCheckoutType('embed')}>
          Embed
        </button>
        <button className={cn('flex-1 rounded-lg px-3 py-2 text-xs font-black', toggle.segment(checkoutType === 'new-tab'))} onClick={() => setCheckoutType('new-tab')}>
          New Tab
        </button>
      </div>
    </div>
  )
}

function TierColorField({
  label,
  value,
  fallbackColor,
  onChange,
  onReset,
  pickerAriaLabel
}: {
  label: string
  value?: string
  fallbackColor: string
  onChange: (color: string | undefined) => void
  onReset: () => void
  pickerAriaLabel: string
}) {
  return (
    <>
      <label className='text-[10px] font-black text-gray-600 uppercase'>{label}</label>
      <div className='flex w-full min-w-0 flex-col gap-2'>
        <div className='flex w-full min-w-0 items-center gap-2'>
          <input
            type='color'
            className='h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-black bg-white p-1'
            value={value ?? fallbackColor}
            onChange={e => onChange(e.target.value)}
            aria-label={pickerAriaLabel}
          />
          <input
            className='min-w-0 flex-1 rounded-lg border border-black bg-white px-3 py-2 font-mono text-sm font-bold'
            value={value ?? ''}
            onChange={e => onChange(e.target.value || undefined)}
            placeholder='Default'
          />
        </div>
        {value && (
          <button type='button' className={cn(btn.secondary, 'w-full px-3 py-2 text-[10px] uppercase')} onClick={onReset}>
            Reset
          </button>
        )}
      </div>
    </>
  )
}

function AccentColorPicker({ accentColor, setAccentColor }: { accentColor: string; setAccentColor: React.Dispatch<React.SetStateAction<string>> }) {
  return (
    <div className='flex flex-col gap-2 rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]'>
      <label className='text-[10px] font-black tracking-wider text-gray-600 uppercase'>Accent Color</label>
      <div className='flex min-w-0 items-center gap-2.5'>
        <input
          type='color'
          className='h-12 w-12 shrink-0 cursor-pointer rounded-lg border-2 border-gray-300 bg-white p-1'
          value={accentColor}
          onChange={e => setAccentColor(e.target.value)}
          aria-label='Accent color picker'
        />
        <input
          className='min-w-0 flex-1 rounded-lg border-2 border-gray-300 bg-gray-50 px-3 py-2.5 font-mono text-sm font-bold text-gray-800 outline-none focus:border-black focus:bg-white'
          value={accentColor}
          onChange={e => setAccentColor(e.target.value)}
          placeholder='#FFBE98'
        />
      </div>
    </div>
  )
}
