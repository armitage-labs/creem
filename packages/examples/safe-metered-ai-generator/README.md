# Aperture - a safe, metered AI image & video generator

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/armitage-labs/creem/tree/main/packages/examples/safe-metered-ai-generator&env=DATABASE_URL,BETTER_AUTH_SECRET,CREEM_API_KEY,CREEM_WEBHOOK_SECRET,CREEM_PRODUCT_STARTER,CREEM_PRODUCT_PRO,CREEM_PRODUCT_STUDIO)

A reference app for running a generative-AI product on [Creem](https://creem.io):
prepaid credit billing with the Customer Credits API and prompt moderation with
the Moderation API. It is built on Next.js 16 with auth, checkout, a studio UI,
and transaction history. Every Creem call uses the official
[`creem`](https://www.npmjs.com/package/creem) SDK.

> **Note:** This is not a real service. There is no model behind the generator by
> default; it ships a deterministic placeholder ("stub") so the billing and
> moderation flow runs without model credentials or cost. To use a real model,
> implement one interface (see below).

## The generation flow

Every generation runs the same four steps, in this order:

```
  ┌──────────┐   ┌────────┐   ┌──────────┐   ┌─────────────────┐
  │ MODERATE │ → │ DEBIT  │ → │ GENERATE │ → │ RETURN / REVERSE│
  └──────────┘   └────────┘   └──────────┘   └─────────────────┘
   screen the     charge        call the       return asset; if the
   prompt first   credits       model          model failed after the
   (block deny/   up front      (black box)    debit, reverse it so the
   flag; fail     (idempotent)                 user keeps their credits
   closed)
```

The route enforces this order on every request. See
[`src/app/api/generate/route.ts`](src/app/api/generate/route.ts).

## Creem is the only backend

There is no local or offline fallback. Credits are stored in the Creem Customer
Credits API and prompts are screened by the Creem Moderation API, both through
the `creem` SDK. If any required key or secret is missing, the app throws at
startup and lists what is missing (validated with zod in
[`src/lib/env.ts`](src/lib/env.ts)).

## Features

| Module              | Where                                                                                                        | Notes                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Credit wallet**   | [`src/lib/wallet.ts`](src/lib/wallet.ts), [`src/lib/creem/credits-creem.ts`](src/lib/creem/credits-creem.ts) | `creemClient.customerCredits.*` - create account, credit / debit / reverse, balance (incl. point-in-time `?at=`) |
| **Moderation**      | [`src/lib/creem/moderation.ts`](src/lib/creem/moderation.ts)                                                 | `creemClient.moderation.screenPrompt`. Blocks on `deny` and `flag`. Fails closed on error/timeout                |
| **Generation flow** | [`src/app/api/generate/route.ts`](src/app/api/generate/route.ts)                                             | moderate → debit → generate → return, with idempotency keys and failure reversal                                 |
| **Checkout**        | [`src/app/api/checkout/route.ts`](src/app/api/checkout/route.ts)                                             | Opens a Creem checkout for the pack's product; the webhook credits the wallet                                    |
| **Webhook**         | [`src/lib/auth.ts`](src/lib/auth.ts)                                                                         | Creem plugin verifies signatures; `onCheckoutCompleted` credits the wallet                                       |
| **Auth gate**       | [`src/proxy.ts`](src/proxy.ts), [`src/lib/session.ts`](src/lib/session.ts)                                   | Next 16 Proxy is the cookie pre-filter; `withUser()` is the per-route session check                              |
| **Ops utilities**   | [`src/app/api/credits/`](src/app/api/credits/)                                                               | Transaction history, freeze / unfreeze, close (audit trail preserved)                                            |
| **Auth ↔ customer** | [`@creem_io/better-auth`](https://www.npmjs.com/package/@creem_io/better-auth)                               | Email/password; maps users to Creem customers                                                                    |
| **UI**              | [`src/app/`](src/app/)                                                                                       | Landing (hero + pricing), auth, studio (balance widget, upload + options, gallery, history)                      |

## Architecture

```
Next.js 16 (App Router)
├─ proxy.ts ─ cookie pre-filter on protected /api/* (Next 16 "Proxy",
│               formerly middleware); rejects requests with no session cookie
├─ Better Auth (email/password) + @creem_io/better-auth plugin
│    · user ↔ creemCustomerId  (synced on first checkout)
│    · /api/auth/creem/webhook → onCheckoutCompleted → ensure wallet + credit
├─ withUser() ─ per-route session check   src/lib/session.ts
├─ Wallet layer   src/lib/wallet.ts
│    └─ CreemCreditsProvider → creem SDK  customerCredits.*
│         credit / debit / reverse · balance (+ ?at=) · entries · freeze/unfreeze/close
│    (credit_ledger_cache mirrors every movement for audit + reference enrichment)
├─ Moderation     src/lib/creem/moderation.ts → creem SDK  moderation.screenPrompt
├─ Generator      src/lib/generator/  (swappable: StubGenerator, default)
└─ Neon Postgres  (Better Auth tables + credit_account, generation, credit_ledger_cache)
```

Auth is two layers. `proxy.ts` runs first and rejects requests to protected
`/api/*` routes that have no session cookie. Each route then re-checks the
session with `withUser()` (Better Auth `getSession`). The cookie check is a fast
pre-filter; the route check is the real one. Both Next.js and Better Auth
recommend this split, because a cookie can be forged.

The credit wallet is created lazily, on the user's **first completed checkout**,
not at sign-up or first login. Opening a Credit Account needs a Creem customer
id, and in this app that id is minted by the `@creem_io/better-auth` plugin as
part of checkout, which then syncs it onto `user.creemCustomerId`. The
`checkout.completed` webhook calls `ensureAccountForUser`, which creates the
wallet if it is missing and then credits the purchased pack. Until then a user
simply has no wallet, and the studio prompts them to buy a pack.

Provisioning the wallet earlier is possible if you want it. Creem exposes a
standalone `POST /v1/customers` endpoint (email plus name) that returns a
`cust_…` id, so you could create the customer and its Credit Account at first
login instead. This app keeps creation on first checkout so it never mints empty
wallets for users who sign up but never buy.

## Quick start

### Prerequisites

- Node.js 22+, pnpm 10+
- A Neon (or any) Postgres database
- A Creem account with an API key, a webhook signing secret, and three one-time
  products (Starter / Pro / Studio). All are required.

### 1. Install and configure

```bash
pnpm install
cp .env.example .env.local
# Fill in every value. The app validates them at startup and lists any that are missing.
```

Generate a Better Auth secret: `openssl rand -base64 32`.

### 2. Migrate the database

```bash
pnpm db:migrate
```

This creates the Better Auth tables and the app tables (`credit_account`,
`generation`, `credit_ledger_cache`).

### 3. Run

```bash
pnpm dev
# http://localhost:3000
```

Sign up, buy a pack, then generate. Buy opens a Creem checkout, and the wallet is
credited when the `checkout.completed` webhook fires (see the $0 discount flow
below).

## Environment variables

Every variable without a default is required. If one is missing, the app throws
at startup and names all the missing ones at once.

| Var                                       | Required | Purpose                                                                                            |
| ----------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                            | Yes      | Neon/Postgres connection string (pooled)                                                           |
| `BETTER_AUTH_SECRET`                      | Yes      | Session signing secret (`openssl rand -base64 32`)                                                 |
| `CREEM_API_KEY`                           | Yes      | `creem_test_…` (sandbox) or `creem_…` (production). Test vs. prod is auto-detected from the prefix |
| `CREEM_WEBHOOK_SECRET`                    | Yes      | Verifies incoming Creem webhook signatures                                                         |
| `CREEM_PRODUCT_STARTER/PRO/STUDIO`        | Yes      | Maps each pack to its Creem product (used by checkout)                                             |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | No       | App base URL (default `http://localhost:3000`)                                                     |
| `GENERATOR`                               | No       | `stub` (default). Add your own in `src/lib/generator/`                                             |

## Checkout and the $0 discount

The checkout pre-applies a 100%-off discount code (`APERTUREFREE`), so purchases
cost $0 while still running the real checkout, webhook, and crediting path. The
code is a variable in [`src/app/api/checkout/route.ts`](src/app/api/checkout/route.ts):

```ts
// Set to `null` to charge full price.
const DISCOUNT_CODE: string | null = 'APERTUREFREE'
```

To run a checkout:

1. Create three one-time products in the Creem dashboard (Starter / Pro / Studio)
   and put their product ids in `CREEM_PRODUCT_STARTER/PRO/STUDIO`.
2. Create a 100%-off discount code (or reuse `APERTUREFREE`) that applies to all
   three products, then set `DISCOUNT_CODE` to match, or `null` to charge full price.
3. Add a webhook in the dashboard pointing at
   `https://<public-url>/api/auth/creem/webhook`, and copy its signing secret into
   `CREEM_WEBHOOK_SECRET`. For local dev, use a tunnel (see below).
4. Click Buy, complete the Creem checkout (the discount is already applied), and
   the `checkout.completed` webhook calls
   [`onCheckoutCompleted`](src/lib/auth.ts), which credits the wallet.

The success page tells the user the credits are being added, and the balance
widget updates on refresh.

## Local testing (webhooks via localtunnel)

Creem cannot POST the `checkout.completed` webhook to `localhost`. Expose that
one endpoint with [localtunnel](https://github.com/localtunnel/localtunnel) and
the full buy -> webhook -> credit path runs locally.

1. Run the app in one terminal:

   ```bash
   pnpm dev            # http://localhost:3000
   ```

2. Open a tunnel to the same port in another terminal:

   ```bash
   npx localtunnel --port 3000
   # → your url is: https://tidy-otters-jam.loca.lt
   ```

3. In the Creem dashboard, set the webhook URL to
   `https://<subdomain>.loca.lt/api/auth/creem/webhook`, subscribe it to
   `checkout.completed`, and copy its signing secret into `CREEM_WEBHOOK_SECRET`.
   Restart `pnpm dev` after changing env.

4. At `http://localhost:3000`, sign up and buy a pack (the 100%-off code makes it
   $0), then complete the Creem checkout. Creem POSTs the webhook to the tunnel,
   localtunnel forwards it to your local `/api/auth/creem/webhook`,
   [`onCheckoutCompleted`](src/lib/auth.ts) credits the wallet, and the balance
   widget updates on refresh.

Notes:

- You only need the tunnel for the inbound webhook. Keep `NEXT_PUBLIC_APP_URL` and
  `BETTER_AUTH_URL` as `http://localhost:3000` so auth cookies and the success
  redirect stay on localhost while you browse.
- localtunnel shows a one-time reminder page for browser visits (it asks for your
  public IP as a password). Server-to-server webhook POSTs from Creem skip it, so
  crediting still works.
- ngrok is an alternative: `ngrok http 3000` gives an equivalent public URL for
  step 3.

## Verifying moderation (production)

Moderation is required for AI generation products on Creem. The app calls it
through the SDK (`creemClient.moderation.screenPrompt`). To check that your key
reaches Creem directly:

```bash
curl -X POST https://api.creem.io/v1/moderation/prompt \
  -H "x-api-key: $CREEM_API_KEY" \
  -H "content-type: application/json" \
  -d '{"prompt":"a watercolor painting of a sunset","external_id":"verify-001"}'
```

A decision (`allow` / `flag` / `deny`) confirms the integration. Aperture blocks
on both `deny` and `flag`, and fails closed on any error - see
[`src/lib/creem/moderation.ts`](src/lib/creem/moderation.ts).

### Trying every outcome

The studio has one-click example prompts for each path:

- **allow** and **deny** are ordinary prompts, screened by the Moderation API.
- **flag** and **error** carry a demo sentinel
  (`#force-moderation-flag` / `#force-moderation-error`) because the Moderation
  API returns `allow`/`deny` in practice and cannot be forced to `flag` or error
  on demand. A `#force-generation-error` sentinel forces a post-debit model
  failure so you can test the refund/reverse path. All are harmless in production
  and defined in [`src/lib/examples.ts`](src/lib/examples.ts) and
  [`src/lib/generator/stub.ts`](src/lib/generator/stub.ts).

## Deploy to Vercel

1. Push this directory to a Git repo.
2. Import into Vercel. Set every env var above (Project → Settings → Environment
   Variables). Use your Neon pooled connection string.
3. Set `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` to your Vercel URL.
4. Run `pnpm db:migrate` once against your production database.
5. Point your Creem webhook at `https://<your-app>/api/auth/creem/webhook`.

## Scripts

| Command                     | Does                          |
| --------------------------- | ----------------------------- |
| `pnpm dev`                  | Dev server                    |
| `pnpm build` / `pnpm start` | Production build / serve      |
| `pnpm typecheck`            | `tsc --noEmit`                |
| `pnpm db:migrate`           | Apply `db/schema.sql`         |
| `pnpm format`               | Prettier                      |
| `pnpm auth:generate`        | Regenerate Better Auth schema |

## Swapping in a real model

Implement the `Generator` interface and register it:

```ts
// src/lib/generator/fal.ts
export class FalGenerator implements Generator {
  readonly name = 'fal'
  async generate({ prompt, mediaType, imageDataUrl, options }: GenerateInput): Promise<GenerateResult> {
    // call fal, return { url, mediaType }
  }
}
```

Then add a `case 'fal'` in [`getGenerator()`](src/lib/generator/index.ts) and set
`GENERATOR=fal`. Nothing in the billing or moderation flow changes.

## The technical guide

A walkthrough of each module is in the [safe, metered AI generator guide](../../docs/guides/safe-metered-ai-image-video-generator.mdx).

## License

MIT. A reference app, not affiliated with any real service.
