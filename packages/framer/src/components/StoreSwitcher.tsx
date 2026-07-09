import { useEffect, useRef, useState } from 'react'
import type { Store, StoreControls, StoreEnv } from '@/types'
import { Check, ChevronDown, FlaskConical, LogOut, Pencil, Plus, Store as StoreIcon, Trash2, X, iconClass } from '@/icons'
import { keyEnv, storeHasEnv } from '@/services/stores'
import { cn, fitButton } from '@/styles/ui'

const INK = '#151617'
const ENV_LABEL: Record<StoreEnv, string> = { live: 'Live', test: 'Test' }

// Env accents. Test uses Creem's brand peach; live a calm green.
const ENV_STYLE: Record<StoreEnv, { bg: string; fg: string; border: string }> = {
  test: { bg: '#FFE7D6', fg: '#8A4A26', border: '#FFBE98' },
  live: { bg: '#E7F6EC', fg: '#137547', border: '#A7E3C0' }
}

/** Compact store + environment switcher for the connected header. */
export function StoreSwitcher({ controls }: { controls: StoreControls }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { activeStore, activeEnv } = controls

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!activeStore) return null

  return (
    <div ref={rootRef} className='relative'>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('flex max-w-[190px] items-center gap-1.5 rounded-lg border-2 border-black bg-white px-2 py-1.5 text-xs font-black shadow-[2px_2px_0px_0px_#000]', fitButton)}
        style={{ color: INK }}
        aria-haspopup='menu'
        aria-expanded={open}
      >
        <StoreIcon className={iconClass('xxs', 'shrink-0 text-gray-500')} />
        <span className='truncate'>{activeStore.name}</span>
        <EnvBadge env={activeEnv} />
        <ChevronDown className={iconClass('xxs', 'shrink-0 text-gray-500')} />
      </button>

      {open && (
        <div className='absolute right-0 z-50 mt-1.5 w-[252px] rounded-xl border-2 border-black bg-white p-2 shadow-[4px_4px_0px_0px_#000]' role='menu'>
          <p className='px-1 pb-1 text-[10px] font-black tracking-wider text-gray-500 uppercase'>Stores</p>
          <div className='flex flex-col gap-1'>
            {controls.stores.map(store => (
              <StoreItem key={store.id} store={store} active={store.id === activeStore.id} activeEnv={activeEnv} isOnlyStore={controls.stores.length === 1} controls={controls} />
            ))}
          </div>
          <button
            onClick={() => {
              setOpen(false)
              controls.addStore()
            }}
            className={cn(
              'mt-1.5 flex w-full items-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 bg-white px-2 py-2 text-xs font-black text-gray-600 hover:border-black hover:text-black',
              fitButton
            )}
          >
            <Plus className={iconClass('xxs')} />
            Add a new store
          </button>
          <div className='my-2 border-t-2 border-gray-200' />
          <button
            onClick={() => {
              setOpen(false)
              controls.signOut()
            }}
            className={cn(
              'flex w-full items-center gap-1.5 rounded-lg border-2 border-transparent bg-white px-2 py-2 text-xs font-black text-gray-600 hover:text-red-600',
              fitButton
            )}
          >
            <LogOut className={iconClass('xxs')} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function EnvBadge({ env }: { env: StoreEnv }) {
  const s = ENV_STYLE[env]
  return (
    <span
      className='inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase'
      style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}` }}
    >
      {env === 'test' && <FlaskConical className='h-2.5 w-2.5' />}
      {ENV_LABEL[env]}
    </span>
  )
}

/** One store in the list: a collapsible whose body holds its environment toggle + manage actions. */
function StoreItem({ store, active, activeEnv, isOnlyStore, controls }: { store: Store; active: boolean; activeEnv: StoreEnv; isOnlyStore: boolean; controls: StoreControls }) {
  const [expanded, setExpanded] = useState(active)
  const [editing, setEditing] = useState(false)
  const [nameValue, setNameValue] = useState(store.name)
  const [addingEnv, setAddingEnv] = useState<StoreEnv | null>(null)
  const [keyValue, setKeyValue] = useState('')
  const [keyError, setKeyError] = useState('')

  const saveName = () => {
    setEditing(false)
    controls.renameStore(store.id, nameValue)
  }
  const cancelName = () => {
    setEditing(false)
    setNameValue(store.name)
  }
  const openAdd = (env: StoreEnv) => {
    setAddingEnv(env)
    setKeyValue('')
    setKeyError('')
  }
  const cancelAdd = () => {
    setAddingEnv(null)
    setKeyValue('')
    setKeyError('')
  }
  const saveKey = (env: StoreEnv) => {
    const key = keyValue.trim()
    if (keyEnv(key) !== env) {
      setKeyError(`Enter a ${ENV_LABEL[env].toLowerCase()} key (${env === 'test' ? 'creem_test_' : 'creem_'}…).`)
      return
    }
    controls.addKey(store.id, key)
    cancelAdd()
  }

  return (
    <div className={cn('rounded-lg border-2', active ? 'border-black bg-gray-50' : 'border-gray-200 bg-white')}>
      {editing ? (
        <div className='flex items-center gap-1 p-1.5'>
          <input
            autoFocus
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveName()
              if (e.key === 'Escape') cancelName()
            }}
            className='min-w-0 flex-1 rounded-lg border-2 border-black bg-white px-2 py-1.5 text-xs font-bold outline-none'
            style={{ color: INK }}
            aria-label='Store name'
          />
          <EditAction kind='save' onClick={saveName} />
          <EditAction kind='cancel' onClick={cancelName} />
        </div>
      ) : (
        <button
          onClick={() => setExpanded(x => !x)}
          className={cn('flex w-full items-center gap-2 bg-transparent px-2 py-2 text-left text-xs font-black', fitButton)}
          style={{ color: INK }}
          aria-expanded={expanded}
        >
          <ChevronDown className={iconClass('xxs', 'shrink-0 text-gray-400 transition-transform', !expanded && '-rotate-90')} />
          <StoreIcon className={iconClass('xxs', 'shrink-0 text-gray-500')} />
          <span className='min-w-0 flex-1 truncate'>{store.name}</span>
          {active && <EnvBadge env={activeEnv} />}
        </button>
      )}

      {expanded && !editing && (
        <div className='flex flex-col gap-2 border-t-2 border-gray-200 px-2 py-2'>
          <div className='flex gap-1.5'>
            {(['live', 'test'] as StoreEnv[]).map(env => {
              const has = storeHasEnv(store, env)
              const isActive = active && activeEnv === env
              const s = ENV_STYLE[env]
              return (
                <button
                  key={env}
                  onClick={() => (has ? controls.selectStoreEnv(store.id, env) : openAdd(env))}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1 rounded-lg border-2 bg-white px-2 py-1.5 text-xs font-black',
                    isActive ? 'border-black' : 'border-gray-300 text-gray-500',
                    !has && 'border-dashed',
                    fitButton
                  )}
                  style={isActive ? { background: s.bg, color: s.fg, borderColor: INK } : undefined}
                >
                  {env === 'test' && <FlaskConical className='h-3 w-3' />}
                  {has ? ENV_LABEL[env] : `Add ${ENV_LABEL[env].toLowerCase()}`}
                </button>
              )
            })}
          </div>

          {addingEnv && (
            <div className='flex flex-col gap-1'>
              <div className='flex items-center gap-1'>
                <input
                  autoFocus
                  type='password'
                  value={keyValue}
                  onChange={e => setKeyValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveKey(addingEnv)
                    if (e.key === 'Escape') cancelAdd()
                  }}
                  placeholder={addingEnv === 'test' ? 'creem_test_...' : 'creem_live_...'}
                  className={cn('min-w-0 flex-1 rounded-lg border-2 bg-white px-2 py-1.5 text-xs font-bold outline-none', keyError ? 'border-red-500' : 'border-black')}
                  style={{ color: INK }}
                  aria-label={`${ENV_LABEL[addingEnv]} API key`}
                />
                <EditAction kind='save' onClick={() => saveKey(addingEnv)} />
                <EditAction kind='cancel' onClick={cancelAdd} />
              </div>
              {keyError && <span className='text-[10px] font-bold text-red-600'>{keyError}</span>}
            </div>
          )}

          <div className='flex items-center justify-end gap-1'>
            <button
              onClick={() => setEditing(true)}
              className={cn('flex items-center gap-1 rounded-lg bg-transparent px-1.5 py-1 text-[11px] font-black text-gray-500 hover:text-black', fitButton)}
            >
              <Pencil className={iconClass('xxs')} />
              Rename
            </button>
            {!isOnlyStore && (
              <button
                onClick={() => controls.removeStore(store.id)}
                className={cn('flex items-center gap-1 rounded-lg bg-transparent px-1.5 py-1 text-[11px] font-black text-gray-500 hover:text-red-600', fitButton)}
              >
                <Trash2 className={iconClass('xxs')} />
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Small check / x button pair used to confirm or dismiss an inline edit. */
function EditAction({ kind, onClick }: { kind: 'save' | 'cancel'; onClick: () => void }) {
  const isSave = kind === 'save'
  return (
    <button
      onClick={onClick}
      className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg border-2 border-black', isSave ? 'bg-creem-purple' : 'bg-white', fitButton)}
      aria-label={isSave ? 'Save' : 'Cancel'}
    >
      {isSave ? <Check className={iconClass('xxs')} style={{ color: INK }} /> : <X className={iconClass('xxs')} style={{ color: INK }} />}
    </button>
  )
}
