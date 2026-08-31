import type { Store, StoreEnv, StoresState } from '@/types'

/**
 * Persistence + derivation for the multi-store model. A "store" is purely a
 * plugin-side container of `{ liveKey, testKey }`: inserted components carry only
 * a global `productId` + `testMode` and hit static payment links, so the store is
 * never baked into an instance — it only decides which key authenticates product
 * fetches and which catalog you browse.
 *
 * The active environment is derived from (and constrained by) which keys a store
 * actually has. Keys are prefixed — `creem_test_…` is a test key, anything else
 * (`creem_…` / `creem_live_…`) is live — which is how we route a pasted key to the
 * right slot without a manual toggle.
 */

const STORAGE_KEY = 'creem_stores_v1'
const LEGACY_KEY = 'creem_api_key'
const LEGACY_TEST_MODE = 'creem_test_mode'

/** Which environment a raw API key belongs to, by its prefix. */
export function keyEnv(key: string): StoreEnv {
  return key.trim().startsWith('creem_test_') ? 'test' : 'live'
}

/** True once a string looks like a Creem key at all (either env). */
export function looksLikeKey(key: string): boolean {
  return key.trim().startsWith('creem_')
}

export function storeKeyFor(store: Store, env: StoreEnv): string {
  return env === 'test' ? store.testKey : store.liveKey
}

export function storeHasEnv(store: Store, env: StoreEnv): boolean {
  return !!storeKeyFor(store, env).trim()
}

/** The env to prefer for a store: its current-ish choice, else whichever key exists. */
export function resolveEnv(store: Store, preferred: StoreEnv): StoreEnv {
  if (storeHasEnv(store, preferred)) return preferred
  if (storeHasEnv(store, 'live')) return 'live'
  if (storeHasEnv(store, 'test')) return 'test'
  return preferred
}

export function getActiveStore(state: StoresState): Store | undefined {
  return state.stores.find(s => s.id === state.activeStoreId)
}

/** The key used for the active store + env, or '' if none. */
export function getActiveKey(state: StoresState): string {
  const store = getActiveStore(state)
  return store ? storeKeyFor(store, state.activeEnv) : ''
}

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch {
    // fall through
  }
  return `store_${Date.now().toString(36)}`
}

/** Build a fresh store from one or both keys. Env-agnostic — keys are routed by prefix. */
export function makeStore(name: string, keyA: string, keyB = ''): Store {
  const store: Store = { id: newId(), name: name.trim() || 'My store', liveKey: '', testKey: '' }
  for (const raw of [keyA, keyB]) {
    const key = raw.trim()
    if (!key) continue
    if (keyEnv(key) === 'test') store.testKey = key
    else store.liveKey = key
  }
  return store
}

const EMPTY_STATE: StoresState = { stores: [], activeStoreId: '', activeEnv: 'live' }

/** Loads persisted state, migrating the pre-multi-store single-key format if present. */
export function loadStores(): StoresState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StoresState
      if (parsed && Array.isArray(parsed.stores)) return normalize(parsed)
    }
  } catch {
    // ignore malformed state and fall through to migration / empty
  }
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (legacy && looksLikeKey(legacy)) {
    const store = makeStore('My store', legacy)
    const state: StoresState = { stores: [store], activeStoreId: store.id, activeEnv: keyEnv(legacy) }
    saveStores(state)
    localStorage.removeItem(LEGACY_KEY)
    localStorage.removeItem(LEGACY_TEST_MODE)
    return state
  }
  return EMPTY_STATE
}

/** Keeps activeStoreId/activeEnv pointing at something real. */
function normalize(state: StoresState): StoresState {
  if (state.stores.length === 0) return EMPTY_STATE
  const active = state.stores.find(s => s.id === state.activeStoreId) ?? state.stores[0]
  return {
    stores: state.stores,
    activeStoreId: active.id,
    activeEnv: resolveEnv(active, state.activeEnv)
  }
}

export function saveStores(state: StoresState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage may be unavailable; state stays in-memory for the session
  }
}
