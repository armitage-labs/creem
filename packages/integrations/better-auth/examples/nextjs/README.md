# Next.js Example

A minimal Next.js App Router example using the `@creem_io/better-auth` plugin with SQLite and email/password auth.

## Setup

This example uses **pnpm workspaces** so the plugin resolves from the local build automatically.

### 1. Install dependencies (from repo root)

```bash
pnpm install
```

### 2. Build the plugin

```bash
pnpm run build
```

### 3. Configure environment

```bash
cd examples/nextjs
cp .env.example .env.local
```

Edit `.env.local` and fill in your Creem test API key. You can get one from [creem.io](https://creem.io).

### 4. Run database migrations

```bash
pnpm migrate
```

### 5. Start the dev server

```bash
# From repo root:
pnpm --filter examples-nextjs dev

# Or from this directory:
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. **Sign up** with an email and password
2. **Check access** to see your current subscription status
3. **Checkout** to start a subscription (replace `prod_REPLACE_ME` in `page.tsx` with your Creem product ID)
4. After payment, the **success page** confirms your purchase
5. Use the **Customer Portal** to manage your subscription

## Project Structure

```
src/
  lib/
    auth.ts          # Server-side Better-Auth config with Creem plugin
    auth-client.ts   # Client-side auth client with Creem client plugin
  app/
    layout.tsx       # Root layout
    page.tsx         # Home page (auth forms + dashboard)
    success/page.tsx # Post-checkout success page
    api/auth/[...all]/route.ts  # Better-Auth API handler
```
