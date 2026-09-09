'use client'

import { signIn, signUp } from '@/lib/auth-client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignup = mode === 'signup'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = isSignup ? await signUp.email({ name: name || email.split('@')[0], email, password }) : await signIn.email({ email, password })
      if (res.error) {
        setError(res.error.message ?? 'Something went wrong.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold">
        <span className="inline-block h-5 w-5 rounded-full bg-[var(--color-accent)]" aria-hidden />
        Aperture
      </Link>

      <h1 className="text-3xl font-semibold">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
      <p className="text-ink-2 mt-2 text-sm">{isSignup ? 'Sign up, grab a credit pack, and start generating.' : 'Sign in to your credit wallet and studio.'}</p>

      <form onSubmit={onSubmit} className="card mt-8 flex flex-col gap-4 p-6">
        {isSignup && (
          <Field label="Name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
          </Field>
        )}
        <Field label="Email">
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" autoComplete="email" />
        </Field>
        <Field label="Password">
          <input
            className="input"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />
        </Field>

        {error && (
          <p
            className="rounded-lg border border-[color-mix(in_oklch,var(--color-bad)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-bad)_12%,transparent)] px-3 py-2 text-sm text-[var(--color-bad)]"
            role="alert"
          >
            {error}
          </p>
        )}

        <button className="btn btn-primary mt-1" type="submit" disabled={loading}>
          {loading ? 'Working…' : isSignup ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="text-ink-2 mt-6 text-center text-sm">
        {isSignup ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="text-accent underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link href="/signup" className="text-accent underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>

      <style>{`
        .input {
          width: 100%;
          background: var(--color-paper);
          border: 1px solid var(--rule-strong);
          border-radius: var(--radius-md);
          padding: 0.6rem 0.8rem;
          color: var(--color-ink);
          font-size: 0.95rem;
          transition: border-color var(--dur-fast) var(--ease-out);
        }
        .input::placeholder { color: var(--color-ink-3); }
        .input:focus { outline: none; border-color: var(--color-accent); }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-ink-2 text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}
