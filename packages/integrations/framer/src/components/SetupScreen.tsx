import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, iconClass } from '@/icons'
import { btn, card, cn, screen } from '@/styles/ui'
import { keyEnv, looksLikeKey } from '@/services/stores'
import { DocsBadge } from '@/components/DocsBadge'

type SetupScreenProps = {
  mode: 'first-run' | 'add'
  /** Validates + persists the store. Resolves an error string to show inline, or null on success. */
  onConnect: (name: string, liveKey: string, testKey: string) => Promise<string | null>
  onCancel?: () => void
  loading: boolean
}

/** Validation message for a key typed into the field for `expected` env, or null if fine. */
function keyFieldError(value: string, expected: 'live' | 'test'): string | null {
  const key = value.trim()
  if (!key) return null
  if (!looksLikeKey(key)) return 'API keys start with creem_'
  if (keyEnv(key) !== expected) {
    return expected === 'live' ? 'That looks like a test key — paste it in the Test field.' : 'That looks like a live key — paste it in the Live field.'
  }
  return null
}

export function SetupScreen({ mode, onConnect, onCancel, loading }: SetupScreenProps) {
  const [name, setName] = useState('')
  const [liveKey, setLiveKey] = useState('')
  const [testKey, setTestKey] = useState('')
  const [error, setError] = useState('')
  const firstFieldRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  const liveErr = keyFieldError(liveKey, 'live')
  const testErr = keyFieldError(testKey, 'test')
  const hasKey = !!(liveKey.trim() || testKey.trim())
  const canSubmit = hasKey && !liveErr && !testErr && !loading

  const submit = async () => {
    if (!canSubmit) return
    setError('')
    const result = await onConnect(name, liveKey, testKey)
    if (result) setError(result)
  }

  return (
    <div className={screen}>
      {mode === 'add' && (
        <div className={cn(card.header, 'relative justify-center')}>
          <button onClick={onCancel} className={cn(btn.compact, btn.iconSize, 'absolute left-3')} aria-label='Cancel'>
            <ArrowLeft className={iconClass('btn')} />
          </button>
          <span className='text-sm font-black tracking-tight'>Add a store</span>
        </div>
      )}
      <div className='flex flex-1 flex-col gap-3'>
        <div className={cn(card.panel, 'gap-3')}>
          <div>
            <h2 className='m-0 text-xl leading-tight font-black tracking-tight'>{mode === 'add' ? 'New store' : 'Connect Account'}</h2>
            <p className='text-ui-text-muted mt-1 text-xs font-semibold'>Paste your API keys from the dashboard.</p>
          </div>

          <div className='flex flex-col gap-1.5'>
            <label htmlFor='store-name' className='text-xs font-black'>
              Store name
            </label>
            <input
              id='store-name'
              ref={firstFieldRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='My store'
              className='border-ui-border bg-ui-surface-elevated text-ui-text placeholder:text-ui-text-subtle w-full rounded-lg border-2 px-2.5 py-2 text-sm font-bold shadow-[inset_2px_2px_0px_rgba(0,0,0,0.08)] outline-none'
            />
          </div>

          <div className='flex flex-col gap-1.5'>
            <label htmlFor='live-api-key' className='text-xs font-black'>
              Live API Key
            </label>
            <input
              id='live-api-key'
              type='password'
              value={liveKey}
              onChange={e => setLiveKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder='creem_...'
              className={cn(
                'bg-ui-surface-elevated text-ui-text placeholder:text-ui-text-subtle w-full rounded-lg border-2 px-2.5 py-2 text-sm font-bold shadow-[inset_2px_2px_0px_rgba(0,0,0,0.08)] outline-none',
                liveErr ? 'border-ui-danger' : 'border-ui-border'
              )}
              aria-invalid={!!liveErr}
              aria-describedby={liveErr ? 'live-api-key-error' : undefined}
            />
            {liveErr && (
              <span id='live-api-key-error' className='text-ui-danger text-[11px] font-bold'>
                {liveErr}
              </span>
            )}
          </div>

          <div className='flex flex-col gap-1.5'>
            <label htmlFor='test-api-key' className='text-xs font-black'>
              Test API Key
            </label>
            <input
              id='test-api-key'
              type='password'
              value={testKey}
              onChange={e => setTestKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder='creem_test_...'
              className={cn(
                'bg-ui-surface-elevated text-ui-text placeholder:text-ui-text-subtle w-full rounded-lg border-2 px-2.5 py-2 text-sm font-bold shadow-[inset_2px_2px_0px_rgba(0,0,0,0.08)] outline-none',
                testErr ? 'border-ui-danger' : 'border-ui-border'
              )}
              aria-invalid={!!testErr}
              aria-describedby={testErr ? 'test-api-key-error' : undefined}
            />
            {testErr && (
              <span id='test-api-key-error' className='text-ui-danger text-[11px] font-bold'>
                {testErr}
              </span>
            )}
          </div>

          <p className='text-ui-text-subtle text-[11px] font-semibold'>Add at least one key. You can add the other environment later.</p>

          <button onClick={submit} disabled={!canSubmit} className={cn(btn.cta, 'mt-1 text-sm')}>
            {loading ? 'Connecting...' : mode === 'add' ? 'Add store' : 'Connect'}
            {!loading && hasKey && <ArrowRight className={iconClass('md')} aria-hidden='true' />}
          </button>
          {error && (
            <div
              role='alert'
              className='border-ui-border bg-ui-danger-bg text-ui-danger rounded-lg border-2 px-3 py-2.5 text-xs font-extrabold shadow-[2px_2px_0px_0px_var(--ui-shadow)]'
            >
              ⚠️ ERROR: {error}
            </div>
          )}
          <div className='mt-auto flex justify-end'>
            <DocsBadge />
          </div>
        </div>
      </div>
    </div>
  )
}
