# Aperture - a safe, metered AI image & video generator

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/armitage-labs/creem/tree/main/packages/examples/safe-metered-ai-generator&env=DATABASE_URL,BETTER_AUTH_SECRET,CREEM_API_KEY,CREEM_PRODUCT_STARTER,CREEM_PRODUCT_PRO,CREEM_PRODUCT_STUDIO)

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

| Module              | Where                                                                                                        | Notes                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Credit wallet**   | [`src/lib/wallet.ts`](src/lib/wallet.ts), [`src/lib/creem/credits-creem.ts`](src/lib/creem/credits-creem.ts) | `creemClient.customerCredits.*` - create the `generation` wallet, debit / reverse, balance (incl. point-in-time `?at=`) |
| **Moderation**      | [`src/lib/creem/moderation.ts`](src/lib/creem/moderation.ts)                                                 | `creemClient.moderation.screenPrompt`. Blocks on `deny` and `flag`. Fails closed on error/timeout                       |
| **Generation flow** | [`src/app/api/generate/route.ts`](src/app/api/generate/route.ts)                                             | moderate → debit with the moderation id → generate → return, with idempotency keys and failure reversal                 |
| **Checkout**        | [`src/app/api/checkout/route.ts`](src/app/api/checkout/route.ts)                                             | Opens a Creem checkout for the pack's product; Creem credits the wallet from the product's credits feature              |
| **Sign-up**         | [`src/lib/auth.ts`](src/lib/auth.ts)                                                                         | Creates the user's Creem customer and `generation` wallet, with free welcome credits                                    |
| **Auth gate**       | [`src/proxy.ts`](src/proxy.ts), [`src/lib/session.ts`](src/lib/session.ts)                                   | Next 16 Proxy is the cookie pre-filter; `withUser()` is the per-route session check                                     |
| **Ops utilities**   | [`src/app/api/credits/`](src/app/api/credits/)                                                               | Transaction history, freeze / unfreeze, close (audit trail preserved)                                                   |
| **Auth ↔ customer** | [`@creem_io/better-auth`](https://www.npmjs.com/package/@creem_io/better-auth)                               | Email/password; maps users to Creem customers                                                                           |
| **UI**              | [`src/app/`](src/app/)                                                                                       | Landing (hero + pricing), auth, studio (balance widget, upload + options, gallery, history)                             |

## Architecture

```
Next.js 16 (App Router)
├─ proxy.ts ─ cookie pre-filter on protected /api/* (Next 16 "Proxy",
│               formerly middleware); rejects requests with no session cookie
├─ Better Auth (email/password) + @creem_io/better-auth plugin
│    · on sign-up → Creem customer + `generation` wallet (+ welcome credits)
│    · no webhook handler: Creem credits purchases from the product's feature
├─ withUser() ─ per-route session check   src/lib/session.ts
├─ Wallet layer   src/lib/wallet.ts
│    └─ CreemCreditsProvider → creem SDK  customerCredits.*
│         debit (with moderationId) / reverse · balance (+ ?at=) · entries · freeze/unfreeze/close
│    (credit_ledger_cache mirrors the app's debits and reversals for reference enrichment)
├─ Moderation     src/lib/creem/moderation.ts → creem SDK  moderation.screenPrompt
├─ Generator      src/lib/generator/  (swappable: StubGenerator, default)
└─ Neon Postgres  (Better Auth tables + credit_account, generation, credit_ledger_cache)
```

Auth is two layers. `proxy.ts` runs first and rejects requests to protected
`/api/*` routes that have no session cookie. Each route then re-checks the
session with `withUser()` (Better Auth `getSession`). The cookie check is a fast
pre-filter; the route check is the real one. Both Next.js and Better Auth
recommend this split, because a cookie can be forged.

The credit wallet is created when the user **signs up**. A Better Auth
`databaseHooks.user.create.after` hook calls `ensureWalletForUser`, which
creates a Creem customer for the user (`externalId` is the app's user id) and
then a Credit Account named `generation`, with `WELCOME_CREDITS` free credits.
The routes call the same function as a fallback, so a user whose wallet could
not be created at sign-up gets it on first use.

The name `generation` is what makes it the moderated AI generation wallet:

- Credits bought through a product with an "AI generation credits" feature land
  in it automatically. The app never credits a purchase.
- Every debit from it must carry a `moderationId`: the id of a moderation result
  that is `allow`, at most 24 hours old and not used by another debit. Creem
  refuses the debit otherwise, so an unscreened prompt cannot spend credits.

## Quick start

### Prerequisites

- Node.js 22+, pnpm 11+
- A Neon (or any) Postgres database
- A Creem account with an API key

### 1. Install and configure

```bash
pnpm install
cp .env.example .env.local
# Set CREEM_API_KEY first, then create the three credit-pack products:
pnpm products:setup
# Paste the printed CREEM_PRODUCT_* values into .env.local and fill in the remaining variables.
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

Sign up and generate with the free welcome credits, then buy a pack. Buy opens a
Creem checkout, and Creem adds the pack's credits to the wallet when the payment
succeeds (see the $0 discount flow below).

## Environment variables

Every variable without a default is required. If one is missing, the app throws
at startup and names all the missing ones at once.

| Var                                       | Required | Purpose                                                                                            |
| ----------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                            | Yes      | Neon/Postgres connection string (pooled)                                                           |
| `BETTER_AUTH_SECRET`                      | Yes      | Session signing secret (`openssl rand -base64 32`)                                                 |
| `CREEM_API_KEY`                           | Yes      | `creem_test_…` (sandbox) or `creem_…` (production). Test vs. prod is auto-detected from the prefix |
| `CREEM_WEBHOOK_SECRET`                    | No       | Only if you add your own webhook handlers. Purchases are credited without one                      |
| `CREEM_PRODUCT_STARTER/PRO/STUDIO`        | Yes      | Maps each pack to its Creem product (used by checkout)                                             |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | No       | App base URL (default `http://localhost:3000`)                                                     |
| `GENERATOR`                               | No       | `stub` (default). Add your own in `src/lib/generator/`                                             |

## Checkout and the $0 discount

The checkout pre-applies a 100%-off discount code (`APERTUREFREE`), so purchases
cost $0 while still running the real checkout and crediting path. The
code is a variable in [`src/app/api/checkout/route.ts`](src/app/api/checkout/route.ts):

```ts
// Set to `null` to charge full price.
const DISCOUNT_CODE: string | null = 'APERTUREFREE'
```

To run a checkout:

1. Set `CREEM_API_KEY` and run `pnpm products:setup`. The script creates the
   Starter, Pro, and Studio products in the mode selected by the key prefix, each
   with an "AI generation credits" feature, and prints the
   `CREEM_PRODUCT_STARTER/PRO/STUDIO` values for `.env.local`. You can also
   create the three one-time products in the Creem dashboard: on each product,
   open Delivery, click Add, choose "New AI generation credits" and set the
   credit amount.
2. Create a 100%-off discount code (or reuse `APERTUREFREE`) that applies to all
   three products, then set `DISCOUNT_CODE` to match, or `null` to charge full price.
3. Click Buy and complete the Creem checkout (the discount is already applied).
   Creem adds the product's credits to the buyer's generation wallet.

The success page tells the user the credits are being added, and the balance
widget updates on refresh.

No webhook and no tunnel are needed, locally or in production. If you want to
react to a purchase (for example to refresh the balance in an open tab), add a
webhook for `credits.granted` and set `CREEM_WEBHOOK_SECRET`. Do not credit the
wallet from `checkout.completed` or `subscription.paid`: Creem has already done it.

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
