import { useEffect, useRef, useState } from 'react'
import type { Store, StoreControls, StoreEnv } from '@/types'
import { Check, ChevronDown, FlaskConical, LogOut, Pencil, Plus, Store as StoreIcon, Trash2, X, iconClass } from '@/icons'
import { keyEnv, storeHasEnv } from '@/services/stores'
import { cn, fitButton } from '@/styles/ui'

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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { activeStore, activeEnv } = controls

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)')?.focus())
  }, [open])

  if (!activeStore) return null

  return (
    <div ref={rootRef} className='relative'>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen(o => !o)}
        className={cn(
          'border-ui-border bg-ui-surface text-ui-text flex max-w-[190px] items-center gap-1.5 rounded-lg border-2 px-2 py-1.5 text-xs font-black shadow-[2px_2px_0px_0px_var(--ui-shadow)]',
          fitButton
        )}
        aria-haspopup='dialog'
        aria-expanded={open}
        aria-controls='store-switcher-popover'
      >
        <StoreIcon className={iconClass('xxs', 'text-ui-text-subtle shrink-0')} />
        <span className='truncate'>{activeStore.name}</span>
        <EnvBadge env={activeEnv} />
        <ChevronDown className={iconClass('xxs', 'text-ui-text-subtle shrink-0')} />
      </button>

      {open && (
        <div
          ref={panelRef}
          id='store-switcher-popover'
          className='border-ui-border bg-ui-surface text-ui-text absolute right-0 z-50 mt-1.5 w-[252px] rounded-xl border-2 p-2 shadow-[4px_4px_0px_0px_var(--ui-shadow)]'
          role='dialog'
          aria-label='Manage stores'
          onKeyDown={event => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            setOpen(false)
            triggerRef.current?.focus()
          }}
        >
          <p className='text-ui-text-subtle px-1 pb-1 text-[10px] font-black tracking-wider uppercase'>Stores</p>
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
              'border-ui-border-subtle bg-ui-surface text-ui-text-muted hover:border-ui-border hover:text-ui-text mt-1.5 flex w-full items-center gap-1.5 rounded-lg border-2 border-dashed px-2 py-2 text-xs font-black',
              fitButton
            )}
          >
            <Plus className={iconClass('xxs')} />
            Add a new store
          </button>
          <div className='border-ui-border-subtle my-2 border-t-2' />
          <button
            onClick={() => {
              setOpen(false)
              controls.signOut()
            }}
            className={cn(
              'bg-ui-surface text-ui-text-muted hover:text-ui-danger flex w-full items-center gap-1.5 rounded-lg border-2 border-transparent px-2 py-2 text-xs font-black',
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
    <div className={cn('rounded-lg border-2', active ? 'border-ui-border bg-ui-surface-subtle' : 'border-ui-border-subtle bg-ui-surface')}>
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
            className='border-ui-border bg-ui-surface-elevated text-ui-text min-w-0 flex-1 rounded-lg border-2 px-2 py-1.5 text-xs font-bold outline-none'
            aria-label='Store name'
          />
          <EditAction kind='save' onClick={saveName} />
          <EditAction kind='cancel' onClick={cancelName} />
        </div>
      ) : (
        <button
          onClick={() => setExpanded(x => !x)}
          className={cn('text-ui-text flex w-full items-center gap-2 bg-transparent px-2 py-2 text-left text-xs font-black', fitButton)}
          aria-expanded={expanded}
          aria-controls={`store-${store.id}-details`}
        >
          <ChevronDown className={iconClass('xxs', 'text-ui-text-subtle shrink-0 transition-transform', !expanded && '-rotate-90')} />
          <StoreIcon className={iconClass('xxs', 'text-ui-text-subtle shrink-0')} />
          <span className='min-w-0 flex-1 truncate'>{store.name}</span>
          {active && <EnvBadge env={activeEnv} />}
        </button>
      )}

      {expanded && !editing && (
        <div id={`store-${store.id}-details`} className='border-ui-border-subtle flex flex-col gap-2 border-t-2 px-2 py-2'>
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
                    'bg-ui-surface flex flex-1 items-center justify-center gap-1 rounded-lg border-2 px-2 py-1.5 text-xs font-black',
                    isActive ? 'border-ui-border' : 'border-ui-border-subtle text-ui-text-subtle',
                    !has && 'border-dashed',
                    fitButton
                  )}
                  style={isActive ? { background: s.bg, color: s.fg } : undefined}
                  aria-pressed={isActive}
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
                  className={cn(
                    'bg-ui-surface-elevated text-ui-text min-w-0 flex-1 rounded-lg border-2 px-2 py-1.5 text-xs font-bold outline-none',
                    keyError ? 'border-ui-danger' : 'border-ui-border'
                  )}
                  aria-label={`${ENV_LABEL[addingEnv]} API key`}
                  aria-invalid={!!keyError}
                  aria-describedby={keyError ? `store-${store.id}-key-error` : undefined}
                />
                <EditAction kind='save' onClick={() => saveKey(addingEnv)} />
                <EditAction kind='cancel' onClick={cancelAdd} />
              </div>
              {keyError && (
                <span id={`store-${store.id}-key-error`} className='text-ui-danger text-[10px] font-bold'>
                  {keyError}
                </span>
              )}
            </div>
          )}

          <div className='flex items-center justify-end gap-1'>
            <button
              onClick={() => setEditing(true)}
              className={cn('text-ui-text-subtle hover:text-ui-text flex items-center gap-1 rounded-lg bg-transparent px-1.5 py-1 text-[11px] font-black', fitButton)}
            >
              <Pencil className={iconClass('xxs')} />
              Rename
            </button>
            {!isOnlyStore && (
              <button
                onClick={() => controls.removeStore(store.id)}
                className={cn('text-ui-text-subtle hover:text-ui-danger flex items-center gap-1 rounded-lg bg-transparent px-1.5 py-1 text-[11px] font-black', fitButton)}
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
      className={cn('border-ui-border flex size-7 shrink-0 items-center justify-center rounded-lg border-2', isSave ? 'bg-creem-purple' : 'bg-ui-surface', fitButton)}
      aria-label={isSave ? 'Save' : 'Cancel'}
    >
      {isSave ? <Check className={iconClass('xxs', 'text-creem-ink')} /> : <X className={iconClass('xxs', 'text-ui-text')} />}
    </button>
  )
}
