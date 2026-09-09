import { useCallback, useEffect, useState } from 'react'
import type { Store, StoreEnv, StoresState } from '@/types'
import { getActiveKey, getActiveStore, keyEnv, loadStores, makeStore, resolveEnv, saveStores, storeHasEnv } from '@/services/stores'

/**
 * React state for the multi-store model. Owns the persisted {@link StoresState},
 * exposes the derived active store/env/key, and the actions the UI needs to add,
 * switch, edit and remove stores. All mutations use functional updates so actions
 * compose safely; the state is persisted whenever it changes.
 */
export function useStores() {
  const [state, setState] = useState<StoresState>(loadStores)

  useEffect(() => {
    saveStores(state)
  }, [state])

  /** Create a store from one or two keys and make it active. */
  const addStore = useCallback((name: string, keyA: string, keyB = '') => {
    const store = makeStore(name, keyA, keyB)
    // Prefer live when both are present — test is the deliberate opt-in.
    setState(prev => ({ stores: [...prev.stores, store], activeStoreId: store.id, activeEnv: resolveEnv(store, 'live') }))
    return store
  }, [])

  const switchStore = useCallback((id: string) => {
    setState(prev => {
      const store = prev.stores.find(s => s.id === id)
      if (!store) return prev
      return { ...prev, activeStoreId: id, activeEnv: resolveEnv(store, prev.activeEnv) }
    })
  }, [])

  /** Switch the active environment; ignored if the active store has no key for it. */
  const switchEnv = useCallback((env: StoreEnv) => {
    setState(prev => {
      const store = getActiveStore(prev)
      if (!store || !storeHasEnv(store, env)) return prev
      return { ...prev, activeEnv: env }
    })
  }, [])

  /** Select a store AND environment in one step (the store must have that env's key). */
  const selectStoreEnv = useCallback((id: string, env: StoreEnv) => {
    setState(prev => {
      const store = prev.stores.find(s => s.id === id)
      if (!store || !storeHasEnv(store, env)) return prev
      return { ...prev, activeStoreId: id, activeEnv: env }
    })
  }, [])

  /** Patch a store (rename, or add/replace a key — keys are re-slotted by prefix). */
  const updateStore = useCallback((id: string, patch: { name?: string; key?: string }) => {
    setState(prev => {
      const stores = prev.stores.map(s => {
        if (s.id !== id) return s
        const updated: Store = { ...s }
        if (patch.name !== undefined) updated.name = patch.name.trim() || s.name
        if (patch.key !== undefined && patch.key.trim()) {
          const key = patch.key.trim()
          if (keyEnv(key) === 'test') updated.testKey = key
          else updated.liveKey = key
        }
        return updated
      })
      // Adding a key selects that store + env (you added it to use it); otherwise
      // just keep the current env valid for the active store.
      if (patch.key !== undefined && patch.key.trim()) {
        return { ...prev, stores, activeStoreId: id, activeEnv: keyEnv(patch.key.trim()) }
      }
      const active = stores.find(s => s.id === prev.activeStoreId)
      return { ...prev, stores, activeEnv: active ? resolveEnv(active, prev.activeEnv) : prev.activeEnv }
    })
  }, [])

  const removeStore = useCallback((id: string) => {
    setState(prev => {
      const stores = prev.stores.filter(s => s.id !== id)
      if (stores.length === 0) return { stores: [], activeStoreId: '', activeEnv: 'live' }
      const active = id === prev.activeStoreId ? stores[0] : (stores.find(s => s.id === prev.activeStoreId) ?? stores[0])
      return { stores, activeStoreId: active.id, activeEnv: resolveEnv(active, prev.activeEnv) }
    })
  }, [])

  const clearAll = useCallback(() => {
    setState({ stores: [], activeStoreId: '', activeEnv: 'live' })
  }, [])

  const activeStore = getActiveStore(state)
  const activeKey = getActiveKey(state)

  return {
    stores: state.stores,
    activeStore,
    activeStoreId: state.activeStoreId,
    activeEnv: state.activeEnv,
    activeKey,
    testMode: state.activeEnv === 'test',
    hasStores: state.stores.length > 0,
    addStore,
    switchStore,
    switchEnv,
    selectStoreEnv,
    updateStore,
    removeStore,
    clearAll
  }
}
