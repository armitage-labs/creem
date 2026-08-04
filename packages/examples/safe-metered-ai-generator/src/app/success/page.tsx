import Link from 'next/link'

/**
 * Post-checkout landing. The wallet is credited asynchronously by the
 * `checkout.completed` webhook, so we tell the user it may take a moment and
 * send them back to the studio where the balance widget polls.
 */
export default function SuccessPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 text-center">
      <div className="card p-10">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--color-good)_20%,transparent)] text-2xl text-[var(--color-good)]">
          ✓
        </span>
        <h1 className="text-2xl font-semibold">Payment received</h1>
        <p className="text-ink-2 mt-3 text-sm leading-relaxed">
          Thanks! Your credits are being added to your wallet. This happens via a Creem webhook and usually lands within a few seconds.
        </p>
        <Link href="/dashboard" className="btn btn-primary mt-7 w-full">
          Back to the studio
        </Link>
      </div>
    </main>
  )
}
