import { useState, useCallback, useEffect, useRef } from 'react'
import { framer } from '@framer/plugin'
import type { Product, Screen, InsertType, CheckoutType } from '@/types'
import { fetchProducts } from '@/services/api'
import { SetupScreen } from '@/components/SetupScreen'
import { ProductsScreen } from '@/components/ProductsScreen'
import { InsertScreen } from '@/components/InsertScreen'
import { ProductDetailScreen } from '@/components/ProductDetailScreen'

const PLUGIN_CONFIG = {
  POSITION: 'top right' as const,
  WIDTH: 350,
  HEIGHT: 570
}

const STORAGE_KEYS = {
  API_KEY: 'creem_api_key'
}

framer.showUI({
  position: PLUGIN_CONFIG.POSITION,
  width: PLUGIN_CONFIG.WIDTH,
  height: PLUGIN_CONFIG.HEIGHT
})

export function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEYS.API_KEY) ?? '')
  const isKeyStored = !!localStorage.getItem(STORAGE_KEYS.API_KEY)
  const [screen, setScreen] = useState<Screen>(() => (isKeyStored ? 'products' : 'home'))
  const [testMode, setTestMode] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [insertType, setInsertType] = useState<InsertType>('button')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [initialInsertProductId, setInitialInsertProductId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [checkoutType, setCheckoutType] = useState<CheckoutType>('new-tab')
  const fetchAbortRef = useRef<AbortController | null>(null)
  const activeProducts = products.filter(product => product.status === 'active')
  const saveKey = useCallback((key: string) => {
    localStorage.setItem(STORAGE_KEYS.API_KEY, key)
    setApiKey(key)
  }, [])
  const clearKey = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.API_KEY)
    setApiKey('')
    setScreen('home')
    setProducts([])
    setLastSyncedAt(null)
  }, [])
  const loadProducts = useCallback(async (key: string, mode: boolean) => {
    fetchAbortRef.current?.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller
    setLoading(true)
    setError('')
    const result = await fetchProducts(key, mode, {
      signal: controller.signal,
      includeArchived: true
    })
    if (controller.signal.aborted) return
    setLoading(false)
    if (result.error) {
      if (result.error !== 'Request cancelled') setError(result.error)
      return
    }
    setProducts(result.data ?? [])
    setLastSyncedAt(result.syncedAt ?? null)
  }, [])
  useEffect(() => {
    if (!isKeyStored || !apiKey) return
    const controller = new AbortController()
    void (async () => {
      setLoading(true)
      setError('')
      const result = await fetchProducts(apiKey, testMode, {
        signal: controller.signal,
        includeArchived: true
      })
      if (controller.signal.aborted) return
      setLoading(false)
      if (result.error) {
        if (result.error !== 'Request cancelled') setError(result.error)
        return
      }
      setProducts(result.data ?? [])
      setLastSyncedAt(result.syncedAt ?? null)
    })()
    return () => controller.abort()
  }, [apiKey, isKeyStored, testMode])
  useEffect(() => {
    return () => fetchAbortRef.current?.abort()
  }, [])
  if (screen === 'home' || !isKeyStored) {
    return (
      <SetupScreen
        apiKey={apiKey}
        setApiKey={setApiKey}
        onConnect={async key => {
          setLoading(true)
          setError('')
          const result = await fetchProducts(key, testMode, { includeArchived: true })
          setLoading(false)
          if (result.error) {
            setError(result.error)
          } else {
            saveKey(key)
            setProducts(result.data ?? [])
            setLastSyncedAt(result.syncedAt ?? null)
            setScreen('products')
          }
        }}
        testMode={testMode}
        setTestMode={setTestMode}
        loading={loading}
        error={error}
      />
    )
  }
  if (screen === 'insert') {
    return (
      <InsertScreen
        insertType={insertType}
        setInsertType={setInsertType}
        products={activeProducts}
        testMode={testMode}
        checkoutType={checkoutType}
        setCheckoutType={setCheckoutType}
        initialProductId={initialInsertProductId}
        onBack={() => {
          setInitialInsertProductId(null)
          setScreen('products')
        }}
      />
    )
  }
  if (screen === 'productDetail' && selectedProduct) {
    return (
      <ProductDetailScreen
        product={selectedProduct}
        onBack={() => {
          setSelectedProduct(null)
          setScreen('products')
        }}
        onSelect={() => {
          setInitialInsertProductId(selectedProduct.id)
          setInsertType('button')
          setSelectedProduct(null)
          setScreen('insert')
        }}
      />
    )
  }
  return (
    <ProductsScreen
      products={products}
      showArchived={showArchived}
      onShowArchivedChange={setShowArchived}
      testMode={testMode}
      apiKey={apiKey}
      lastSyncedAt={lastSyncedAt}
      onClearKey={clearKey}
      onInsert={type => {
        setInitialInsertProductId(null)
        setInsertType(type)
        setScreen('insert')
      }}
      onProductClick={product => {
        setSelectedProduct(product)
        setScreen('productDetail')
      }}
      onRefresh={() => loadProducts(apiKey, testMode)}
      loading={loading}
      error={error}
    />
  )
}
