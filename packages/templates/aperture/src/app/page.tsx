import { GENERATION_COST, PACKS } from '@/lib/packs'
import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <SiteNav />

      {/* ---- Hero ---------------------------------------------------------- */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28">
        <p className="tag mb-5">Metered generative AI · built on Creem</p>
        <h1 className="max-w-[16ch] text-5xl leading-[1.02] font-semibold sm:text-7xl">
          Generate images &amp; video. <span className="text-accent">Safely. Metered.</span>
        </h1>
        <p className="text-ink-2 mt-6 max-w-[54ch] text-lg leading-relaxed">
          Aperture is a reference app that shows how to charge for AI generation with prepaid credits and screen every prompt for policy violations - using Creem&apos;s Customer
          Credits and Moderation APIs. No wallet tables to design, no race conditions to debug.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/signup" className="btn btn-primary">
            Start generating →
          </Link>
          <Link href="#how" className="btn btn-ghost">
            See the flow
          </Link>
        </div>

        <dl className="border-rule mt-14 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-4">
          <Stat term="Moderation" desc="every prompt, pre-generation" />
          <Stat term="Prepaid" desc="credits debited per render" />
          <Stat term="Idempotent" desc="safe retries, no double-charge" />
          <Stat term="Auto-refund" desc="on a failed generation" />
        </dl>
      </section>

      {/* ---- The ordered flow -------------------------------------------- */}
      <section id="how" className="scroll-mt-20 border-t border-[var(--rule)] py-20 sm:py-28">
        <h2 className="text-3xl font-semibold sm:text-4xl">The whole app is one ordered flow</h2>
        <p className="text-ink-2 mt-4 max-w-[58ch]">
          Reorder these steps and you either charge for content you should have blocked, or leak free compute. Aperture runs them in exactly this order, every time.
        </p>
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Step n="01" title="Moderate" accent>
            Screen the raw prompt through <code className="mono text-accent">POST /moderation/prompt</code>. Block on <b>deny</b> and <b>flag</b>. If moderation errors, fail closed
            - never generate.
          </Step>
          <Step n="02" title="Debit">
            Reserve credits up front with an idempotency key. Insufficient balance stops here with a friendly <span className="mono">402</span>.
          </Step>
          <Step n="03" title="Generate">
            Only now call the model - a swappable black box behind one interface. Drop in fal, Replicate, or your own weights.
          </Step>
          <Step n="04" title="Return / reverse">
            Return the asset. If the model fails after the debit, reverse the transaction so the user keeps their credits.
          </Step>
        </ol>
      </section>

      {/* ---- Pricing ------------------------------------------------------ */}
      <section id="pricing" className="scroll-mt-20 border-t border-[var(--rule)] py-20 sm:py-28">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold sm:text-4xl">Credit packs</h2>
            <p className="text-ink-2 mt-3 max-w-[46ch]">
              One-time purchases. Credits never expire. An image costs {GENERATION_COST.image} credits; a video costs {GENERATION_COST.video}.
            </p>
          </div>
          <p className="tag">no subscription · pay as you render</p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PACKS.map((pack) => (
            <div key={pack.id} className={`card relative flex flex-col p-6 ${pack.featured ? 'ring-1 ring-[var(--color-accent)]' : ''}`}>
              {pack.featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[var(--color-accent-ink)]">Best value</span>
              )}
              <h3 className="text-xl font-semibold">{pack.name}</h3>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="text-4xl font-semibold">${pack.priceUsd}</span>
              </p>
              <p className="text-accent mono mt-2 text-sm">{pack.credits.toLocaleString()} credits</p>
              <p className="text-ink-2 mt-4 flex-1 text-sm leading-relaxed">{pack.blurb}</p>
              <Link href="/signup" className={`btn mt-6 w-full ${pack.featured ? 'btn-primary' : 'btn-ghost'}`}>
                Get {pack.name}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}

function SiteNav() {
  return (
    <header className="sticky top-4 z-20 mt-4">
      <nav className="card mx-auto flex items-center justify-between gap-4 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-block h-5 w-5 rounded-full bg-[var(--color-accent)]" aria-hidden />
          Aperture
        </Link>
        <div className="text-ink-2 hidden items-center gap-6 text-sm sm:flex">
          <Link href="#how" className="hover:text-[var(--color-ink)]">
            How it works
          </Link>
          <Link href="#pricing" className="hover:text-[var(--color-ink)]">
            Pricing
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost text-sm">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary text-sm">
            Get started
          </Link>
        </div>
      </nav>
    </header>
  )
}

function Stat({ term, desc }: { term: string; desc: string }) {
  return (
    <div className="bg-[color-mix(in_oklch,var(--color-paper-2)_60%,transparent)] p-5">
      <dt className="font-display text-lg font-semibold">{term}</dt>
      <dd className="text-ink-3 mt-1 text-sm">{desc}</dd>
    </div>
  )
}

function Step({ n, title, children, accent }: { n: string; title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <li className={`card p-6 ${accent ? 'ring-1 ring-[color-mix(in_oklch,var(--color-accent)_45%,transparent)]' : ''}`}>
      <span className="mono text-accent text-sm">{n}</span>
      <h3 className="mt-2 text-xl font-semibold">{title}</h3>
      <p className="text-ink-2 mt-2 text-sm leading-relaxed">{children}</p>
    </li>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-[var(--rule)] py-10">
      <div className="text-ink-3 flex flex-col items-start justify-between gap-4 text-sm sm:flex-row sm:items-center">
        <p>
          Aperture - a Creem reference app. Not affiliated with any real service. Built to demonstrate{' '}
          <a href="https://docs.creem.io" className="text-accent underline-offset-4 hover:underline">
            Creem
          </a>{' '}
          Customer Credits + Moderation.
        </p>
        <div className="flex gap-5">
          <Link href="/login" className="hover:text-[var(--color-ink)]">
            Sign in
          </Link>
          <Link href="#pricing" className="hover:text-[var(--color-ink)]">
            Pricing
          </Link>
        </div>
      </div>
    </footer>
  )
}
