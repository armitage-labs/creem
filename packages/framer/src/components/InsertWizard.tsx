import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { framer, useIsAllowedTo } from '@framer/plugin'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, ChevronUp, Image, Info, Loader2, RefreshCcw, iconClass } from '@/icons'
import type { Product, InsertType, CheckoutType, PricingLayout, GridColumns, TierConfig, StoreControls } from '@/types'
import { getBillingPeriodLabel, matchesProductSearch } from '@/utils/productHelpers'
import { ensureComponentInsertURL, withFramerIcons } from '@/utils/codeFileHelpers'
import { badge, btn, card, cn, fitButton, screen, toggle } from '@/styles/ui'
import BUTTON_COMPONENT_SOURCE from '@/framer/checkout-button.tsx?raw'
import PRICING_TABLE_COMPONENT_SOURCE from '@/framer/pricing-table.tsx?raw'
import { ProductSearchInput } from '@/components/ProductSearchInput'
import { ProductPicker, PLUGIN_ACCENT, type PickerItem } from '@/components/ProductPicker'
import { StoreSwitcher } from '@/components/StoreSwitcher'

const DEFAULTS = {
  BUTTON_TEXT: 'Buy Now',
  PRICING_LAYOUT: 'grid' as const,
  GRID_COLUMNS: 3 as const,
  CTA_TEXT: 'Get Started',
  HEADER_TITLE: 'Choose your plan',
  HEADER_DESCRIPTION: 'Select the plan that works best for you.'
}

const PRICING_LIMITS = {
  MIN_TIERS: 1
}

// Mirrors the inserted pricing-table: recurring intervals ordered shortest→longest,
// with the tab wording the rendered component uses (Quarterly/Semi-annual, not "3 Months").
// Kept here (not imported) because the frozen component can't share plugin modules.
const INTERVAL_ORDER = ['every-day', 'every-month', 'every-three-months', 'every-six-months', 'every-year'] as const
const INTERVAL_TAB_LABEL: Record<string, string> = {
  'every-day': 'Daily',
  'every-month': 'Monthly',
  'every-three-months': 'Quarterly',
  'every-six-months': 'Semi-annual',
  'every-year': 'Yearly'
}

type WizardStep = 'chooseComponent' | 'selectProducts' | 'configure'

type InsertWizardProps = {
  products: Product[]
  testMode: boolean
  checkoutType: CheckoutType
  setCheckoutType: React.Dispatch<React.SetStateAction<CheckoutType>>
  lastSyncedAt: number | null
  loading: boolean
  error?: string
  onRefresh: () => void
  storeControls: StoreControls
}

function createTierConfig(key: string, name: string, description: string): TierConfig {
  return {
    key,
    name,
    description: description || `Perfect for ${name.toLowerCase()} users`,
    ctaText: DEFAULTS.CTA_TEXT,
    highlighted: false
  }
}

function formatSyncedAt(timestamp: number | null): string | null {
  if (!timestamp) return null
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function InsertWizard({ products, testMode, checkoutType, setCheckoutType, lastSyncedAt, loading, error, onRefresh, storeControls }: InsertWizardProps) {
  const [step, setStep] = useState<WizardStep>('chooseComponent')
  const [insertType, setInsertType] = useState<InsertType>('button')
  const [selectedId, setSelectedId] = useState<string>('')
  const [buttonText, setButtonText] = useState<string>(DEFAULTS.BUTTON_TEXT)
  const [inserting, setInserting] = useState(false)
  const [success, setSuccess] = useState(false)
  // Inserting a component both writes a code file and drops an instance on the
  // canvas. Gate on both protected methods so we can disable the action (and
  // explain why) instead of letting it fail mid-flow when access is missing.
  const isAllowedToInsert = useIsAllowedTo('createCodeFile', 'addComponentInstance')
  const [search, setSearch] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [pricingLayout, setPricingLayout] = useState<PricingLayout>(DEFAULTS.PRICING_LAYOUT)
  const [gridColumns, setGridColumns] = useState<GridColumns>(DEFAULTS.GRID_COLUMNS)
  const [headerTitle, setHeaderTitle] = useState(DEFAULTS.HEADER_TITLE)
  const [headerDescription, setHeaderDescription] = useState(DEFAULTS.HEADER_DESCRIPTION)
  const [tierConfigs, setTierConfigs] = useState<Record<string, TierConfig>>({})
  const [editingTierKey, setEditingTierKey] = useState<string | null>(null)
  const upsertTierConfig = useCallback((key: string, name: string, description: string) => {
    setTierConfigs(prev => {
      if (prev[key]) return prev
      return { ...prev, [key]: createTierConfig(key, name, description) }
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
  const toggleProduct = (id: string, name: string, description: string) => {
    setSelectedProducts(prev => {
      if (prev.includes(id)) {
        removeTierConfig(id)
        return prev.filter(p => p !== id)
      }
      upsertTierConfig(id, name, description)
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
  const prevSelectedCount = useRef(0)
  useEffect(() => {
    const wasEmpty = prevSelectedCount.current === 0
    prevSelectedCount.current = selectedProducts.length
    setEditingTierKey(prev => {
      // Keep the currently-open tier open as long as it's still selected.
      if (prev && selectedProducts.includes(prev)) return prev
      // Auto-open the first tier ONLY on the initial 0 → N population, so that
      // reordering (same keys, new order) or deselecting never yanks a tier
      // back open — which made reordering painful.
      if (wasEmpty && selectedProducts.length > 0) return selectedProducts[0]
      return null
    })
  }, [selectedProducts])
  const handleInsert = useCallback(async () => {
    if (!isAllowedToInsert) {
      framer.notify("You don't have permission to insert components into this project.", { variant: 'error' })
      return
    }
    if (insertType === 'button' && !selectedId) {
      framer.notify('Please select a product from the dropdown', { variant: 'error' })
      return
    }
    if (insertType === 'button' && !buttonText.trim()) {
      framer.notify('Please enter the button text', { variant: 'error' })
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
          const p = products.find(prod => prod.id === selectionId)!
          const config = tierConfigs[selectionId] ?? createTierConfig(selectionId, p.name, p.description)
          const isOneTime = p.type === 'one_time'
          return {
            name: config.name,
            priceCents: p.price,
            price: (p.price ?? 0) / 100,
            currency: p.currency,
            isOneTime,
            billingPeriod: isOneTime ? 'once' : p.billingPeriod || 'every-month',
            productId: p.id,
            ctaText: config.ctaText,
            ctaVariant: 'default',
            highlighted: config.highlighted,
            description: config.description
          }
        })
        await framer.addComponentInstance({
          url: insertURL,
          attributes: {
            controls: {
              tiers,
              type: checkoutType,
              testMode,
              table: {
                layout: pricingLayout,
                gridColumns: pricingLayout === 'grid' ? gridColumns : undefined
              },
              header: {
                showHeader: !!(headerTitle.trim() || headerDescription.trim()),
                headerTitle: headerTitle.trim(),
                headerDescription: headerDescription.trim()
              },
              billingToggle: {
                showIntervalTabs: true
              }
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
    isAllowedToInsert,
    insertType,
    selectedId,
    buttonText,
    checkoutType,
    testMode,
    selectedProducts,
    products,
    tierConfigs,
    pricingLayout,
    gridColumns,
    headerTitle,
    headerDescription
  ])
  const selectedProduct = products.find(p => p.id === selectedId)

  if (step === 'chooseComponent') {
    return (
      <ChooseComponentStep
        storeControls={storeControls}
        onChoose={type => {
          setInsertType(type)
          setStep('selectProducts')
        }}
      />
    )
  }

  if (step === 'selectProducts') {
    return (
      <SelectProductsStep
        insertType={insertType}
        products={products}
        search={search}
        setSearch={setSearch}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        selectedProducts={selectedProducts}
        toggleProduct={toggleProduct}
        lastSyncedAt={lastSyncedAt}
        loading={loading}
        error={error}
        onRefresh={onRefresh}
        onBack={() => setStep('chooseComponent')}
        onContinue={() => setStep('configure')}
      />
    )
  }

  return (
    <div className={cn(screen, 'min-w-0')}>
      <WizardHeader title='Configure' onBack={() => setStep('selectProducts')} />
      {insertType === 'button' ? (
        <ButtonConfiguration
          buttonText={buttonText}
          setButtonText={setButtonText}
          checkoutType={checkoutType}
          setCheckoutType={setCheckoutType}
          selectedProduct={selectedProduct}
        />
      ) : (
        <PricingConfiguration
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
          products={products}
          selectedProducts={selectedProducts}
          moveProduct={moveProduct}
          tierConfigs={tierConfigs}
          editingTierKey={editingTierKey}
          setEditingTierKey={setEditingTierKey}
          updateTierConfig={updateTierConfig}
        />
      )}
      {!isAllowedToInsert && (
        <div className='flex shrink-0 items-start gap-2.5 rounded-lg border-2 border-yellow-500 bg-yellow-100 px-3 py-3 text-xs leading-relaxed font-bold text-yellow-900'>
          <Info className={iconClass('sm', 'mt-0.5 shrink-0')} />
          <p>You don&rsquo;t have permission to add code or components to this project. Ask the project owner for edit access to insert.</p>
        </div>
      )}
      <button
        className={cn(btn.cta, 'shrink-0 text-sm tracking-tight')}
        onClick={handleInsert}
        disabled={!isAllowedToInsert || inserting || success || (insertType === 'button' && !selectedId) || (insertType === 'pricing' && selectedProducts.length < 1)}
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

function WizardHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className={cn(card.header, 'relative justify-center')}>
      <button onClick={onBack} className={cn(btn.compact, btn.iconSize, 'absolute left-3')} aria-label='Go back'>
        <ArrowLeft className={iconClass('btn')} />
      </button>
      <span className='text-sm font-black tracking-tight'>{title}</span>
    </div>
  )
}

type ChooseComponentStepProps = {
  onChoose: (type: InsertType) => void
  storeControls: StoreControls
}

function ChooseComponentStep({ onChoose, storeControls }: ChooseComponentStepProps) {
  return (
    <div className={screen}>
      <div className={cn(card.header, 'justify-between')}>
        <img src='/creem.svg' alt='Creem Logo' className='block h-[18px]' />
        <StoreSwitcher controls={storeControls} />
      </div>
      <div className='flex flex-1 flex-col gap-3'>
        <p className='text-xs font-bold text-gray-600'>Choose a component to add to your canvas.</p>
        <ComponentCard title='Checkout Button' subtitle='One product, one button.' glyph={<ButtonGlyph />} onClick={() => onChoose('button')} />
        <ComponentCard title='Pricing Table' subtitle='Compare several products in a grid.' glyph={<TableGlyph />} onClick={() => onChoose('pricing')} />
      </div>
    </div>
  )
}

function ComponentCard({ title, subtitle, glyph, onClick }: { title: string; subtitle: string; glyph: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn(card.interactive, fitButton, 'w-full shrink-0 items-center gap-3.5 p-4 text-left')}>
      <div className='shrink-0'>{glyph}</div>
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <span className='text-sm leading-tight font-black tracking-tight text-black'>{title}</span>
        <span className='text-xs leading-snug font-bold text-gray-500'>{subtitle}</span>
      </div>
      <ArrowRight className={iconClass('md', 'shrink-0 text-gray-400')} aria-hidden='true' />
    </button>
  )
}

/** Mini preview of a checkout button. */
function ButtonGlyph() {
  return (
    <div className='bg-creem-cream flex h-16 w-16 items-center justify-center rounded-lg border-2 border-black'>
      <span className='bg-creem-peach rounded border-2 border-black px-2.5 py-1.5 text-[9px] font-black text-black shadow-[1.5px_1.5px_0_0_#151617]'>Buy</span>
    </div>
  )
}

/** Mini preview of a pricing table (three columns, middle one featured). */
function TableGlyph() {
  return (
    <div className='bg-creem-cream flex h-16 w-16 items-center justify-center gap-1 rounded-lg border-2 border-black'>
      {[0, 1, 2].map(i => (
        <div key={i} className={cn('flex h-10 w-3 flex-col overflow-hidden rounded-sm border border-black', i === 1 ? 'bg-creem-peach' : 'bg-white')}>
          <div className='bg-creem-purple h-3 w-full border-b border-black' />
        </div>
      ))}
    </div>
  )
}

type SelectProductsStepProps = {
  insertType: InsertType
  products: Product[]
  search: string
  setSearch: (value: string) => void
  selectedId: string
  setSelectedId: React.Dispatch<React.SetStateAction<string>>
  selectedProducts: string[]
  toggleProduct: (id: string, name: string, description: string) => void
  lastSyncedAt: number | null
  loading: boolean
  error?: string
  onRefresh: () => void
  onBack: () => void
  onContinue: () => void
}

function SelectProductsStep({
  insertType,
  products,
  search,
  setSearch,
  selectedId,
  setSelectedId,
  selectedProducts,
  toggleProduct,
  lastSyncedAt,
  loading,
  error,
  onRefresh,
  onBack,
  onContinue
}: SelectProductsStepProps) {
  const isButton = insertType === 'button'
  const syncedLabel = formatSyncedAt(lastSyncedAt)

  const buttonItems = useMemo<PickerItem[]>(() => {
    const matching = products.filter(p => matchesProductSearch(p, search))
    const ordered = !selectedId || matching.some(p => p.id === selectedId) ? matching : [products.find(p => p.id === selectedId), ...matching].filter((p): p is Product => !!p)
    return ordered.map(p => ({
      key: p.id,
      productId: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      currency: p.currency,
      type: p.type,
      billingPeriod: p.billingPeriod,
      image_url: p.image_url,
      badge: p.type === 'one_time' ? 'One-time' : 'Subscription'
    }))
  }, [products, search, selectedId])

  // Every product is its own tier — one multi-select row per product, keyed by product id.
  const pricingItems = useMemo<PickerItem[]>(
    () =>
      products
        .filter(p => matchesProductSearch(p, search))
        .map(p => ({
          key: p.id,
          productId: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          currency: p.currency,
          type: p.type,
          billingPeriod: p.billingPeriod,
          image_url: p.image_url,
          badge: p.type === 'one_time' ? 'One-time' : getBillingPeriodLabel(p.billingPeriod)
        })),
    [products, search]
  )

  const items = isButton ? buttonItems : pricingItems
  const canContinue = isButton ? !!selectedId : selectedProducts.length >= 1

  return (
    <div className={screen}>
      <WizardHeader title={isButton ? 'Select a product' : 'Select products'} onBack={onBack} />
      <div className={card.panel}>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='m-0 text-sm font-black tracking-tight'>Products</h3>
            {syncedLabel && <p className='m-0 mt-0.5 text-[10px] font-bold text-gray-500'>Synced {syncedLabel}</p>}
          </div>
          <div className='flex items-center gap-2'>
            <button onClick={onRefresh} disabled={loading} className={cn(btn.icon, 'rounded-md')} aria-label='Refresh products'>
              <RefreshCcw className={iconClass('xxs', loading && 'animate-spin')} aria-hidden='true' />
            </button>
            <div className={badge}>{items.length}</div>
          </div>
        </div>
        <ProductSearchInput value={search} onChange={setSearch} />
        {error && <div className='rounded-lg border-2 border-red-400 bg-red-50 px-3 py-2 text-xs font-bold text-red-800'>{error}</div>}
        <div className='-mx-1 flex flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto px-1 pt-1'>
          {items.length === 0 ? (
            <div className='py-8 text-center text-sm font-bold text-gray-500'>
              {loading ? 'Loading products…' : search.trim() ? `No products match "${search.trim()}".` : 'No active products found.'}
            </div>
          ) : isButton ? (
            // Single-select: picking a product IS the action — advance straight to configure, no Continue step.
            <ProductPicker
              items={items}
              mode='single'
              selection={selectedId ? [selectedId] : []}
              onSelect={item => {
                setSelectedId(item.key)
                onContinue()
              }}
            />
          ) : (
            <ProductPicker items={items} mode='multi' selection={selectedProducts} onSelect={item => toggleProduct(item.key, item.name, item.description)} />
          )}
        </div>
      </div>
      {!isButton && (
        <button className={cn(btn.cta, 'shrink-0 text-sm tracking-tight')} onClick={onContinue} disabled={!canContinue}>
          Continue <ArrowRight className={iconClass('sm')} aria-hidden='true' />
        </button>
      )}
    </div>
  )
}

type ButtonConfigurationProps = {
  buttonText: string
  setButtonText: React.Dispatch<React.SetStateAction<string>>
  checkoutType: CheckoutType
  setCheckoutType: React.Dispatch<React.SetStateAction<CheckoutType>>
  selectedProduct: Product | undefined
}

function ButtonConfiguration({ buttonText, setButtonText, checkoutType, setCheckoutType, selectedProduct }: ButtonConfigurationProps) {
  return (
    <div className='flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2.5 overflow-y-auto'>
      {/* Product context — compact row (thumbnail matches the picker), kept separate
          from the Preview so the name/ID aren't mistaken for part of the button. */}
      {selectedProduct && (
        <div className='flex items-center gap-2.5 rounded-xl border-2 border-black bg-white p-2.5 shadow-[3px_3px_0px_0px_#000]'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-black bg-gray-100'>
            {selectedProduct.image_url ? (
              <img src={selectedProduct.image_url} className='h-full w-full object-cover' alt='' />
            ) : (
              <Image className={iconClass('sm', 'text-gray-300')} aria-hidden='true' />
            )}
          </div>
          <div className='flex min-w-0 flex-1 flex-col'>
            <span className='truncate text-sm font-black text-black' title={selectedProduct.name}>
              {selectedProduct.name}
            </span>
            <span className='truncate text-[10px] font-bold text-gray-500' title={selectedProduct.id}>
              ID: <code className='font-mono text-gray-600'>{selectedProduct.id}</code>
            </span>
          </div>
        </div>
      )}
      {/* Settings — checkout type + button text grouped in one card. */}
      <div className='flex flex-col gap-2.5 rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]'>
        <div className='flex flex-col gap-1.5'>
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
        <div className='flex flex-col gap-1.5'>
          <label className='text-[10px] font-black tracking-wider text-gray-600 uppercase'>Button Text</label>
          <input
            className='w-full rounded-lg border border-black bg-white px-3 py-2 text-sm font-bold text-black outline-none placeholder:text-gray-400'
            value={buttonText}
            onChange={e => setButtonText(e.target.value)}
            placeholder='Buy Now'
          />
        </div>
      </div>
      {/* Preview — the payoff, kept visible without scrolling. */}
      <div className='flex flex-col items-center gap-2 rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]'>
        <p className='self-start text-[10px] font-black tracking-wider text-gray-600 uppercase'>Preview</p>
        {/* Mirrors the real checkout-button defaults (auto width, 12/24 padding, radius 10,
            15px/600). `w-auto` is required — framer.css forces buttons to full width otherwise,
            which made the preview look far wider than the rendered component. */}
        <button
          className={cn('w-auto cursor-default', fitButton)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            padding: '12px 24px',
            borderRadius: 10,
            border: 'none',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            color: '#FFFFFF',
            backgroundColor: PLUGIN_ACCENT
          }}
        >
          {buttonText || 'Buy Now'}
        </button>
      </div>
    </div>
  )
}

type PricingConfigurationProps = {
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
  products: Product[]
  selectedProducts: string[]
  moveProduct: (from: number, to: number) => void
  tierConfigs: Record<string, TierConfig>
  editingTierKey: string | null
  setEditingTierKey: React.Dispatch<React.SetStateAction<string | null>>
  updateTierConfig: (key: string, patch: Partial<TierConfig>) => void
}

function PricingConfiguration({
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
  products,
  selectedProducts,
  moveProduct,
  tierConfigs,
  editingTierKey,
  setEditingTierKey,
  updateTierConfig
}: PricingConfigurationProps) {
  const featuredIndex = selectedProducts.findIndex(id => tierConfigs[id]?.highlighted)
  const hasHeader = !!(headerTitle.trim() || headerDescription.trim())
  const multiTier = selectedProducts.length > 1

  // Mirror the inserted table: when products span ≥2 recurring intervals it renders
  // interval tabs and shows only ONE interval at a time (plus any one-time tiers) —
  // so the preview must show a toggle + the visible subset, not all cards at once.
  const tierIntervals = selectedProducts.map(id => {
    const p = products.find(prod => prod.id === id)
    return p && p.type !== 'one_time' ? p.billingPeriod || 'every-month' : 'once'
  })
  const intervalsPresent = INTERVAL_ORDER.filter(iv => tierIntervals.includes(iv))
  const showTabs = intervalsPresent.length >= 2
  // Default to the featured tier's interval (matches the runtime first-paint fix),
  // else the first interval present.
  const featuredTierInterval = featuredIndex >= 0 ? tierIntervals[featuredIndex] : undefined
  const activeInterval = showTabs
    ? featuredTierInterval && featuredTierInterval !== 'once' && intervalsPresent.includes(featuredTierInterval)
      ? featuredTierInterval
      : intervalsPresent[0]
    : undefined
  const visibleIndices = showTabs
    ? selectedProducts.map((_, i) => i).filter(i => tierIntervals[i] === 'once' || tierIntervals[i] === activeInterval)
    : selectedProducts.map((_, i) => i)
  const previewTierCount = visibleIndices.length
  const previewFeaturedIndex = visibleIndices.indexOf(featuredIndex)
  const previewTabs = showTabs ? intervalsPresent.map(iv => ({ label: INTERVAL_TAB_LABEL[iv] ?? iv, active: iv === activeInterval })) : null

  return (
    <div className='flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2.5 overflow-y-auto'>
      {/* Layout — live preview colocated so changes show immediately. */}
      <div className='flex w-full min-w-0 flex-col gap-2.5 rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]'>
        {selectedProducts.length > 0 && (
          <PricingMiniPreview
            layout={pricingLayout}
            gridColumns={gridColumns}
            tierCount={previewTierCount}
            featuredIndex={previewFeaturedIndex}
            hasHeader={hasHeader}
            tabs={previewTabs}
          />
        )}
        <div className='flex flex-col gap-1.5'>
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
        </div>
        {pricingLayout === 'grid' && (
          <div className='flex flex-col gap-1.5'>
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
      {/* Header — table-level text. */}
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
          className='min-h-[48px] w-full resize-y rounded-lg border border-black bg-white px-3 py-2.5 text-sm font-semibold text-black outline-none placeholder:text-gray-400'
          rows={2}
          value={headerDescription}
          onChange={e => setHeaderDescription(e.target.value)}
          placeholder='Select the plan that works best for you.'
        />
      </div>
      {/* Tiers — one list that both reorders and edits each tier (merged Order + Edit Tiers). */}
      {selectedProducts.length > 0 && (
        <div className='flex w-full min-w-0 flex-col gap-2 rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]'>
          <label className='text-[10px] font-black tracking-wider text-gray-600 uppercase'>Tiers</label>
          <div className='flex w-full flex-col gap-2'>
            {selectedProducts.map((key, i) => {
              const config = tierConfigs[key]
              if (!config) return null
              const isOpen = editingTierKey === key
              return (
                <div key={key} className='w-full rounded-lg border-2 border-gray-300 bg-gray-50'>
                  <div className='flex items-center gap-1 px-2 py-1.5'>
                    {multiTier && <span className='w-5 shrink-0 text-center text-xs font-black text-gray-500'>#{i + 1}</span>}
                    <button
                      className='text-creem-ink flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-1 border-0 bg-transparent px-1 py-1 text-left text-sm font-black shadow-none'
                      onClick={() => setEditingTierKey(isOpen ? null : key)}
                    >
                      <span className='truncate' title={config.name}>
                        {config.name}
                      </span>
                      {isOpen ? <ChevronUp className={iconClass('xs', 'shrink-0 text-gray-500')} /> : <ChevronDown className={iconClass('xs', 'shrink-0 text-gray-500')} />}
                    </button>
                    {multiTier && (
                      <div className='flex shrink-0 gap-1'>
                        <button className={cn(btn.secondary, btn.iconSize)} onClick={() => moveProduct(i, i - 1)} disabled={i === 0} aria-label='Move tier up'>
                          <ArrowUp className={iconClass('btn')} />
                        </button>
                        <button
                          className={cn(btn.secondary, btn.iconSize)}
                          onClick={() => moveProduct(i, i + 1)}
                          disabled={i === selectedProducts.length - 1}
                          aria-label='Move tier down'
                        >
                          <ArrowDown className={iconClass('btn')} />
                        </button>
                      </div>
                    )}
                  </div>
                  {isOpen && (
                    <div className='flex w-full flex-col gap-2 border-t border-gray-300 px-3 py-3'>
                      <label className='text-[10px] font-black text-gray-600 uppercase'>Tier Name</label>
                      <input
                        className='text-creem-ink w-full rounded-lg border border-black bg-white px-3 py-2 text-sm font-bold'
                        value={config.name}
                        onChange={e => updateTierConfig(key, { name: e.target.value })}
                      />
                      <label className='text-[10px] font-black text-gray-600 uppercase'>Description</label>
                      <p className='text-[10px] font-semibold text-gray-500'>Supports markdown — use `- item` for a list.</p>
                      <textarea
                        className='text-creem-ink min-h-[72px] w-full resize-y rounded-lg border border-black bg-white px-3 py-2 text-sm font-semibold'
                        value={config.description}
                        onChange={e => updateTierConfig(key, { description: e.target.value })}
                      />
                      <label className='text-[10px] font-black text-gray-600 uppercase'>CTA Text</label>
                      <input
                        className='text-creem-ink w-full rounded-lg border border-black bg-white px-3 py-2 text-sm font-bold'
                        value={config.ctaText}
                        onChange={e => updateTierConfig(key, { ctaText: e.target.value })}
                      />
                      <label className='text-md mt-2 flex items-center gap-2 font-bold'>
                        <input
                          type='checkbox'
                          className='size-[14px]'
                          style={{ accentColor: PLUGIN_ACCENT }}
                          checked={config.highlighted}
                          onChange={e => updateTierConfig(key, { highlighted: e.target.checked })}
                        />
                        <span>Feature this tier</span>
                      </label>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* Checkout Type — behavior. */}
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
    </div>
  )
}

/**
 * Stylized, non-interactive schematic of the pricing table that mirrors the chosen
 * layout + columns + tier count live, so the layout controls have immediate feedback.
 * Each mini-card echoes the real card order: title → price → CTA → feature lines.
 */
function PricingMiniPreview({
  layout,
  gridColumns,
  tierCount,
  featuredIndex,
  hasHeader,
  tabs
}: {
  layout: PricingLayout
  gridColumns: GridColumns
  tierCount: number
  featuredIndex: number
  hasHeader: boolean
  tabs: { label: string; active: boolean }[] | null
}) {
  const cols = layout === 'grid' ? Math.min(gridColumns, Math.max(tierCount, 1)) : layout === 'vertical' ? 1 : tierCount
  const containerStyle: React.CSSProperties =
    layout === 'vertical'
      ? { display: 'flex', flexDirection: 'column', gap: 6 }
      : layout === 'horizontal'
        ? { display: 'flex', flexDirection: 'row', gap: 6, overflow: 'hidden' }
        : { display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 6 }
  return (
    <div className='rounded-lg border-2 border-gray-300 bg-gray-50 p-3'>
      {hasHeader && (
        <div className='mb-2.5 flex flex-col items-center gap-1'>
          <div className='h-2 w-20 rounded-full bg-gray-400' />
          <div className='h-1 w-28 rounded-full bg-gray-300' />
        </div>
      )}
      {tabs && tabs.length > 0 && (
        <div className='mb-2.5 flex items-center justify-center gap-1'>
          {tabs.map(tab => (
            <span key={tab.label} className={cn('rounded-full px-2 py-0.5 text-[8px] font-black', tab.active ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-500')}>
              {tab.label}
            </span>
          ))}
        </div>
      )}
      <div className='overflow-hidden' style={{ maxHeight: 168 }}>
        <div style={containerStyle}>
          {Array.from({ length: tierCount }).map((_, i) => (
            <MiniTierCard key={i} featured={i === featuredIndex} fixedWidth={layout === 'horizontal'} />
          ))}
        </div>
      </div>
    </div>
  )
}

function MiniTierCard({ featured, fixedWidth }: { featured: boolean; fixedWidth: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-md bg-white p-2',
        featured ? 'border-creem-purple border-2' : 'border border-gray-300',
        fixedWidth ? 'w-14 shrink-0' : 'w-full'
      )}
    >
      <div className='h-1 w-7 rounded-full bg-gray-400' />
      <div className='h-2.5 w-9 rounded bg-gray-800' />
      <div className='h-2 w-full rounded' style={{ background: featured ? PLUGIN_ACCENT : '#d1d5db' }} />
      <div className='flex w-full flex-col items-center gap-1 pt-0.5'>
        <div className='h-0.5 w-full rounded-full bg-gray-200' />
        <div className='h-0.5 w-4/5 rounded-full bg-gray-200' />
        <div className='h-0.5 w-3/5 rounded-full bg-gray-200' />
      </div>
    </div>
  )
}
