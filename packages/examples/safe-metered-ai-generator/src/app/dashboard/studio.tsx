'use client'

import { signOut } from '@/lib/auth-client'
import { EXAMPLE_PROMPTS, ExampleKind, KIND_META, displayPrompt } from '@/lib/examples'
import { MAX_IMAGE_BYTES, MAX_IMAGE_LABEL } from '@/lib/limits'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

type PackDto = { id: 'starter' | 'pro' | 'studio'; name: string; credits: number; priceUsd: number; featured: boolean }
type Costs = { image: number; video: number }

type BalanceState = { hasWallet: boolean; balance: string; unitLabel: string; status: 'active' | 'frozen' | 'closed' | null; asOf?: string }
type Generation = { id: string; prompt: string; mediaType: string; cost: number; status: string; decision: string | null; url: string | null; createdAt: string }
type Entry = { id: string; side: 'credit' | 'debit'; amount: string; reference?: string | null; created_at: string }

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export function Studio({ user, packs, costs }: { user: { name: string; email: string }; packs: PackDto[]; costs: Costs }) {
  const router = useRouter()
  const [balance, setBalance] = useState<BalanceState | null>(null)
  const [generations, setGenerations] = useState<Generation[]>([])
  const [history, setHistory] = useState<Entry[]>([])
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const showToast = useCallback((kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const refreshBalance = useCallback(async () => {
    const res = await fetch('/api/credits/balance', { cache: 'no-store' })
    if (res.ok) setBalance(await res.json())
  }, [])

  const refreshGenerations = useCallback(async () => {
    const res = await fetch('/api/generations', { cache: 'no-store' })
    if (res.ok) setGenerations((await res.json()).generations)
  }, [])

  const refreshHistory = useCallback(async () => {
    const res = await fetch('/api/credits/history', { cache: 'no-store' })
    if (res.ok) setHistory((await res.json()).entries)
  }, [])

  const refreshAll = useCallback(() => {
    void refreshBalance()
    void refreshGenerations()
    void refreshHistory()
  }, [refreshBalance, refreshGenerations, refreshHistory])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
      <TopBar
        user={user}
        onSignOut={async () => {
          await signOut()
          router.push('/')
          router.refresh()
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ---- Left: generation + gallery ---- */}
        <div className="flex flex-col gap-6">
          <GeneratePanel
            costs={costs}
            balance={balance}
            onDone={(msg, ok) => {
              showToast(ok ? 'ok' : 'err', msg)
              refreshAll()
            }}
          />
          <Gallery generations={generations} />
        </div>

        {/* ---- Right: wallet + packs + history + ops ---- */}
        <aside className="flex flex-col gap-6">
          <BalanceWidget balance={balance} onRefresh={refreshBalance} showToast={showToast} />
          <PackShop
            packs={packs}
            onBought={(msg, ok) => {
              showToast(ok ? 'ok' : 'err', msg)
              refreshAll()
            }}
          />
          <HistoryPanel entries={history} unit={balance?.unitLabel ?? 'credits'} />
          <OpsPanel
            status={balance?.status ?? null}
            onChanged={(msg, ok) => {
              showToast(ok ? 'ok' : 'err', msg)
              refreshBalance()
            }}
          />
        </aside>
      </div>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border px-4 py-2 text-sm shadow-lg backdrop-blur ${
            toast.kind === 'ok'
              ? 'border-[color-mix(in_oklch,var(--color-good)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-good)_16%,var(--color-paper))] text-[var(--color-good)]'
              : 'border-[color-mix(in_oklch,var(--color-bad)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-bad)_16%,var(--color-paper))] text-[var(--color-bad)]'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ TopBar */
function TopBar({ user, onSignOut }: { user: { name: string; email: string }; onSignOut: () => void }) {
  return (
    <header className="flex items-center justify-between gap-4 py-6">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <span className="inline-block h-5 w-5 rounded-full bg-[var(--color-accent)]" aria-hidden />
        Aperture
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-ink-2 hidden text-sm sm:inline">{user.email}</span>
        <button className="btn btn-ghost text-sm" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  )
}

/* ---------------------------------------------------------- GeneratePanel */
function GeneratePanel({ costs, balance, onDone }: { costs: Costs; balance: BalanceState | null; onDone: (msg: string, ok: boolean) => void }) {
  const [prompt, setPrompt] = useState('')
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [style, setStyle] = useState('photorealistic')
  const [aspect, setAspect] = useState('1:1')
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>()
  const [imageName, setImageName] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ url: string; mediaType: string } | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const cost = costs[mediaType]
  const bal = Number(balance?.balance ?? 0)
  const insufficient = balance?.hasWallet && bal < cost
  const frozen = balance?.status && balance.status !== 'active'

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_IMAGE_BYTES) {
      onDone(`Image must be under ${MAX_IMAGE_LABEL}.`, false)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImageDataUrl(reader.result as string)
      setImageName(file.name)
    }
    reader.readAsDataURL(file)
  }

  async function generate() {
    if (!prompt.trim()) return
    setBusy(true)
    setResult(null)
    setBlocked(null)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt,
          mediaType,
          imageDataUrl,
          options: { style, aspect },
          idempotencyKey: `gen_${crypto.randomUUID()}`,
        }),
      })
      const data = await res.json()
      if (res.ok && data.status === 'completed') {
        setResult({ url: data.url, mediaType: data.mediaType })
        onDone(`Generated for ${data.cost} credits.`, true)
      } else if (data.status === 'rejected') {
        setBlocked(data.message ?? 'Prompt rejected by moderation.')
        onDone(`Blocked by moderation (${data.decision}).`, false)
      } else if (data.error === 'insufficient_credits') {
        onDone(data.message ?? 'Not enough credits.', false)
      } else if (data.status === 'refunded') {
        onDone('Generation failed - credits refunded.', false)
      } else if (data.error === 'no_wallet') {
        onDone('Buy a credit pack to start generating.', false)
      } else {
        onDone(data.message ?? 'Generation failed.', false)
      }
    } catch (err) {
      onDone((err as Error).message, false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Studio</h2>
        <div className="inline-flex rounded-full border border-[var(--rule-strong)] p-0.5">
          {(['image', 'video'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMediaType(m)}
              className={`rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors ${mediaType === m ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]' : 'text-ink-2'}`}
            >
              {m} · {costs[m]}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder="A watercolor lighthouse at sunset, soft golden light…"
        className="mt-4 w-full resize-y rounded-[var(--radius-md)] border border-[var(--rule-strong)] bg-[var(--color-paper)] px-3.5 py-3 text-[0.95rem] placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-accent)] focus:outline-none"
      />

      <ExamplePrompts onPick={setPrompt} />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Select label="Style" value={style} onChange={setStyle} options={['photorealistic', 'illustration', 'watercolor', '3d-render', 'anime']} />
        <Select label="Aspect" value={aspect} onChange={setAspect} options={['1:1', '16:9', '9:16', '4:3']} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        <button className="btn btn-ghost text-sm" onClick={() => fileRef.current?.click()} type="button">
          {imageName ? `📎 ${imageName.slice(0, 18)}` : '📎 Reference image'}
        </button>
        {imageName && (
          <button
            className="text-ink-3 text-sm hover:text-[var(--color-ink)]"
            onClick={() => {
              setImageDataUrl(undefined)
              setImageName(undefined)
            }}
            type="button"
          >
            clear
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={generate} disabled={busy || !prompt.trim() || !!insufficient || !!frozen || balance?.hasWallet === false}>
          {busy ? 'Generating…' : `Generate - ${cost} credits`}
        </button>
        {balance?.hasWallet === false && <span className="text-ink-3 text-sm">Buy a pack first →</span>}
        {insufficient && (
          <span className="text-sm text-[var(--color-warn)]">
            Not enough credits ({bal}/{cost}).
          </span>
        )}
        {frozen && <span className="text-sm text-[var(--color-warn)]">Account {balance?.status}.</span>}
      </div>

      {blocked && (
        <div className="mt-5 rounded-[var(--radius-md)] border border-[color-mix(in_oklch,var(--color-bad)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-bad)_10%,transparent)] p-4">
          <p className="text-sm font-semibold text-[var(--color-bad)]">Blocked by moderation</p>
          <p className="text-ink-2 mt-1 text-sm">{blocked}</p>
          <p className="text-ink-3 mt-2 text-xs">No credits were charged - moderation runs before any debit.</p>
        </div>
      )}

      {result && (
        <figure className="mt-5 overflow-hidden rounded-[var(--radius-md)] border border-[var(--rule)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.url} alt="Latest generation" className="w-full" />
        </figure>
      )}
    </section>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="text-ink-2 flex items-center gap-2 text-sm">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[var(--radius-sm)] border border-[var(--rule-strong)] bg-[var(--color-paper)] px-2 py-1 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

/* -------------------------------------------------------- ExamplePrompts */
const KIND_STYLE: Record<ExampleKind, string> = {
  success: 'border-[color-mix(in_oklch,var(--color-good)_45%,transparent)] text-[var(--color-good)]',
  flag: 'border-[color-mix(in_oklch,var(--color-warn)_45%,transparent)] text-[var(--color-warn)]',
  deny: 'border-[color-mix(in_oklch,var(--color-bad)_45%,transparent)] text-[var(--color-bad)]',
  error: 'border-[var(--rule-strong)] text-ink-2',
}
function ExamplePrompts({ onPick }: { onPick: (p: string) => void }) {
  return (
    <div className="mt-3">
      <p className="text-ink-3 mb-2 text-xs">Try an example prompt - two for each moderation outcome:</p>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_PROMPTS.map((ex, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(ex.prompt)}
            title={`${KIND_META[ex.kind].hint} - ${displayPrompt(ex.prompt)}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-[var(--color-paper-3)] ${KIND_STYLE[ex.kind]}`}
          >
            <span className="mono uppercase">{KIND_META[ex.kind].label}</span>
            <span className="text-ink-3 max-w-[15ch] truncate">{displayPrompt(ex.prompt)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Gallery */
function Gallery({ generations }: { generations: Generation[] }) {
  const done = generations.filter((g) => g.url)
  return (
    <section className="card p-6">
      <h2 className="text-xl font-semibold">Gallery</h2>
      {done.length === 0 ? (
        <p className="text-ink-3 mt-4 text-sm">Your generations will appear here.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {done.map((g) => (
            <figure key={g.id} className="group overflow-hidden rounded-[var(--radius-md)] border border-[var(--rule)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.url!} alt={g.prompt} className="aspect-square w-full object-cover" />
              <figcaption className="text-ink-3 truncate px-2 py-1.5 text-xs" title={g.prompt}>
                {g.mediaType === 'video' ? '▶ ' : ''}
                {g.prompt}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  )
}

/* --------------------------------------------------------- BalanceWidget */
function BalanceWidget({ balance, onRefresh, showToast }: { balance: BalanceState | null; onRefresh: () => void; showToast: (k: 'ok' | 'err', m: string) => void }) {
  const [at, setAt] = useState('')
  const [pit, setPit] = useState<string | null>(null)

  async function checkPointInTime() {
    if (!at) return
    const iso = new Date(at).toISOString()
    const res = await fetch(`/api/credits/balance?at=${encodeURIComponent(iso)}`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      setPit(data.balance)
    } else {
      showToast('err', 'Could not read historical balance.')
    }
  }

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between">
        <span className="tag">Wallet</span>
      </div>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-semibold">{balance ? Number(balance.balance).toLocaleString() : '-'}</span>
        <span className="text-ink-3 text-sm">{balance?.unitLabel ?? 'credits'}</span>
      </p>
      {balance?.status && balance.status !== 'active' && <p className="mt-1 text-sm text-[var(--color-warn)]">Account {balance.status}</p>}
      {balance?.hasWallet === false && <p className="text-ink-3 mt-1 text-sm">No wallet yet - buy a pack below.</p>}

      <button className="btn btn-ghost mt-4 w-full text-sm" onClick={onRefresh}>
        Refresh balance
      </button>

      <details className="mt-4">
        <summary className="text-ink-2 cursor-pointer text-sm">Point-in-time balance</summary>
        <div className="mt-3 flex flex-col gap-2">
          <input
            type="datetime-local"
            value={at}
            onChange={(e) => setAt(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[var(--rule-strong)] bg-[var(--color-paper)] px-2 py-1 text-sm text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          <button className="btn btn-ghost text-sm" onClick={checkPointInTime}>
            Check balance at
          </button>
          {pit !== null && (
            <p className="text-ink-2 text-sm">
              Balance then: <b className="text-[var(--color-ink)]">{Number(pit).toLocaleString()}</b>
            </p>
          )}
        </div>
      </details>
    </section>
  )
}

/* -------------------------------------------------------------- PackShop */
function PackShop({ packs, onBought }: { packs: PackDto[]; onBought: (msg: string, ok: boolean) => void }) {
  const [busy, setBusy] = useState<string | null>(null)

  async function buy(packId: string) {
    setBusy(packId)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packId }),
      })
      const data = await res.json()
      if (data.mode === 'checkout' && data.url) {
        window.location.href = data.url
        return
      }
      onBought(data.message ?? 'Could not start checkout.', false)
    } catch (err) {
      onBought((err as Error).message, false)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card p-6">
      <span className="tag">Buy credits</span>
      <div className="mt-3 flex flex-col gap-2">
        {packs.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between rounded-[var(--radius-md)] border p-3 ${p.featured ? 'border-[color-mix(in_oklch,var(--color-accent)_45%,transparent)]' : 'border-[var(--rule)]'}`}
          >
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-ink-3 text-xs">
                {p.credits.toLocaleString()} credits · ${p.priceUsd}
              </p>
            </div>
            <button className={`btn text-sm ${p.featured ? 'btn-primary' : 'btn-ghost'}`} onClick={() => buy(p.id)} disabled={busy === p.id}>
              {busy === p.id ? '…' : 'Buy'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ HistoryPanel */
function HistoryPanel({ entries, unit }: { entries: Entry[]; unit: string }) {
  return (
    <section className="card p-6">
      <span className="tag">Transaction history</span>
      {entries.length === 0 ? (
        <p className="text-ink-3 mt-3 text-sm">No transactions yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-[var(--rule)]">
          {entries.slice(0, 12).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-ink-3 truncate" title={e.reference ?? ''}>
                {referenceLabel(e.reference)}
              </span>
              <span className={e.side === 'credit' ? 'font-medium text-[var(--color-good)]' : 'font-medium text-[var(--color-ink)]'}>
                {e.side === 'credit' ? '+' : '−'}
                {Number(e.amount).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-ink-3 mt-3 text-xs">Amounts in {unit}. Full audit trail preserved even after closing.</p>
    </section>
  )
}

function referenceLabel(ref?: string | null): string {
  if (!ref) return 'transaction'
  if (ref.startsWith('pack:')) return 'Credit pack purchase'
  if (ref.startsWith('gen:')) return 'Generation'
  if (ref.startsWith('refund:') || ref.startsWith('reversal')) return 'Refund (failed generation)'
  return ref
}

/* ---------------------------------------------------------------- OpsPanel */
function OpsPanel({ status, onChanged }: { status: 'active' | 'frozen' | 'closed' | null; onChanged: (msg: string, ok: boolean) => void }) {
  const [busy, setBusy] = useState(false)

  async function act(action: 'freeze' | 'unfreeze' | 'close') {
    if (action === 'close' && !confirm('Closing is permanent. Balance and history stay readable, but no new transactions are allowed. Continue?')) return
    setBusy(true)
    try {
      const res = await fetch('/api/credits/account', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (res.ok) onChanged(`Account ${data.status}.`, true)
      else onChanged(data.message ?? 'Action failed.', false)
    } finally {
      setBusy(false)
    }
  }

  if (!status) return null

  return (
    <section className="card p-6">
      <span className="tag">Demo operations</span>
      <p className="text-ink-3 mt-2 text-xs">
        Freeze, unfreeze and close, exposed here so you can try them. In a production app these belong behind admin authorization, with an audit log and a confirmation step for
        each action.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {status === 'active' && (
          <button className="btn btn-ghost text-sm" onClick={() => act('freeze')} disabled={busy}>
            Freeze
          </button>
        )}
        {status === 'frozen' && (
          <button className="btn btn-ghost text-sm" onClick={() => act('unfreeze')} disabled={busy}>
            Unfreeze
          </button>
        )}
        {status !== 'closed' && (
          <button className="btn btn-ghost text-sm text-[var(--color-bad)]" onClick={() => act('close')} disabled={busy}>
            Close
          </button>
        )}
        {status === 'closed' && <span className="text-ink-3 text-sm">Account closed - read-only.</span>}
      </div>
    </section>
  )
}
