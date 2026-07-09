import { useState, useCallback, useEffect, useRef } from 'react'
import { framer } from '@framer/plugin'
import type { Product, Screen, CheckoutType } from '@/types'
import { fetchProducts } from '@/services/api'
import { SetupScreen } from '@/components/SetupScreen'
import { InsertWizard } from '@/components/InsertWizard'

const PLUGIN_CONFIG = {
  POSITION: 'top right' as const,
  WIDTH: 350,
  HEIGHT: 570
}

const STORAGE_KEYS = {
  API_KEY: 'creem_api_key',
  TEST_MODE: 'creem_test_mode'
}

framer.showUI({
  position: PLUGIN_CONFIG.POSITION,
  width: PLUGIN_CONFIG.WIDTH,
  height: PLUGIN_CONFIG.HEIGHT
})

export function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEYS.API_KEY) ?? '')
  const isKeyStored = !!localStorage.getItem(STORAGE_KEYS.API_KEY)
  const [screen, setScreen] = useState<Screen>(() => (isKeyStored ? 'connected' : 'home'))
  const [testMode, setTestMode] = useState(() => localStorage.getItem(STORAGE_KEYS.TEST_MODE) === 'true')
  const [products, setProducts] = useState<Product[]>([])
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkoutType, setCheckoutType] = useState<CheckoutType>('new-tab')
  const fetchAbortRef = useRef<AbortController | null>(null)
  const activeProducts = products.filter(product => product.status === 'active')
  const saveKey = useCallback((key: string, mode: boolean) => {
    localStorage.setItem(STORAGE_KEYS.API_KEY, key)
    localStorage.setItem(STORAGE_KEYS.TEST_MODE, String(mode))
    setApiKey(key)
  }, [])
  const clearKey = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.API_KEY)
    localStorage.removeItem(STORAGE_KEYS.TEST_MODE)
    setApiKey('')
    setTestMode(false)
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
            saveKey(key, testMode)
            setProducts(result.data ?? [])
            setLastSyncedAt(result.syncedAt ?? null)
            setScreen('connected')
          }
        }}
        testMode={testMode}
        setTestMode={setTestMode}
        loading={loading}
        error={error}
      />
    )
  }
  return (
    <InsertWizard
      products={activeProducts}
      testMode={testMode}
      checkoutType={checkoutType}
      setCheckoutType={setCheckoutType}
      lastSyncedAt={lastSyncedAt}
      loading={loading}
      error={error}
      onRefresh={() => loadProducts(apiKey, testMode)}
      onLogout={clearKey}
    />
  )
}
