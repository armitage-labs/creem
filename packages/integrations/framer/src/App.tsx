import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { framer } from '@framer/plugin'
import type { Product, CheckoutType, StoreControls } from '@/types'
import { fetchProducts } from '@/services/api'
import { keyEnv } from '@/services/stores'
import { useStores } from '@/hooks/useStores'
import { SetupScreen } from '@/components/SetupScreen'
import { InsertWizard } from '@/components/InsertWizard'
import { TestModeChrome } from '@/components/TestModeChrome'

const PLUGIN_CONFIG = {
  POSITION: 'top right' as const,
  WIDTH: 350,
  HEIGHT: 570
}

framer.showUI({
  position: PLUGIN_CONFIG.POSITION,
  width: PLUGIN_CONFIG.WIDTH,
  height: PLUGIN_CONFIG.HEIGHT
})

export function App() {
  const store = useStores()
  // 'add' shows the setup screen to append another store; otherwise the wizard.
  const [adding, setAdding] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkoutType, setCheckoutType] = useState<CheckoutType>('new-tab')
  const fetchAbortRef = useRef<AbortController | null>(null)
  const activeProducts = products.filter(product => product.status === 'active')

  const { activeKey, activeStoreId, testMode } = store

  // Re-fetch whenever the active store or environment changes.
  useEffect(() => {
    if (!activeKey) {
      setProducts([])
      setLastSyncedAt(null)
      return
    }
    const controller = new AbortController()
    fetchAbortRef.current = controller
    // Never expose products from the previous store/environment while the new
    // catalog is loading. Product ids are scoped to their environment.
    setProducts([])
    setLastSyncedAt(null)
    void (async () => {
      setLoading(true)
      setError('')
      const result = await fetchProducts(activeKey, testMode, { signal: controller.signal, includeArchived: true })
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
  }, [activeStoreId, testMode, activeKey])

  useEffect(() => {
    return () => fetchAbortRef.current?.abort()
  }, [])

  const refresh = useCallback(() => {
    if (!activeKey) return
    fetchAbortRef.current?.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller
    void (async () => {
      setLoading(true)
      setError('')
      const result = await fetchProducts(activeKey, testMode, { signal: controller.signal, includeArchived: true })
      if (controller.signal.aborted) return
      setLoading(false)
      if (result.error) {
        if (result.error !== 'Request cancelled') setError(result.error)
        return
      }
      setProducts(result.data ?? [])
      setLastSyncedAt(result.syncedAt ?? null)
    })()
  }, [activeKey, testMode])

  /**
   * Validate the key that will be active first, then persist the store. Returns
   * an error string to display inline, or null on success.
   */
  const connectStore = useCallback(
    async (name: string, liveKey: string, testKey: string): Promise<string | null> => {
      const primaryKey = liveKey.trim() || testKey.trim()
      const primaryTestMode = keyEnv(primaryKey) === 'test'
      setLoading(true)
      setError('')
      const result = await fetchProducts(primaryKey, primaryTestMode, { includeArchived: true })
      setLoading(false)
      if (result.error) return result.error
      store.addStore(name, liveKey, testKey)
      setProducts(result.data ?? [])
      setLastSyncedAt(result.syncedAt ?? null)
      setAdding(false)
      return null
    },
    [store]
  )

  const storeControls = useMemo<StoreControls>(
    () => ({
      stores: store.stores,
      activeStore: store.activeStore,
      activeEnv: store.activeEnv,
      switchStore: store.switchStore,
      switchEnv: store.switchEnv,
      selectStoreEnv: store.selectStoreEnv,
      addStore: () => setAdding(true),
      renameStore: (id, newName) => store.updateStore(id, { name: newName }),
      removeStore: store.removeStore,
      addKey: (id, key) => store.updateStore(id, { key }),
      signOut: store.clearAll
    }),
    [store]
  )

  if (!store.hasStores || adding) {
    return <SetupScreen mode={store.hasStores ? 'add' : 'first-run'} onConnect={connectStore} onCancel={store.hasStores ? () => setAdding(false) : undefined} loading={loading} />
  }

  return (
    <TestModeChrome active={testMode}>
      <InsertWizard
        // Wizard selections and tier configuration belong to one catalog. A
        // new key forces an immediate remount when the store or stage changes,
        // preventing test products from carrying over into live (and vice versa).
        key={`${activeStoreId}:${testMode ? 'test' : 'live'}`}
        products={activeProducts}
        testMode={testMode}
        checkoutType={checkoutType}
        setCheckoutType={setCheckoutType}
        lastSyncedAt={lastSyncedAt}
        loading={loading}
        error={error}
        onRefresh={refresh}
        storeControls={storeControls}
      />
    </TestModeChrome>
  )
}
