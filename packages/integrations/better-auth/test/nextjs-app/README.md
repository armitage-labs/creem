# Better Auth integration test app

This private Next.js application is a manual test harness for `@creem_io/better-auth`. It imports
the package's local build, uses SQLite, and exercises authentication, checkout, the customer
portal, subscription access, transactions, and webhook callbacks.

For a smaller Better Auth + Next.js example intended as a starting point for package users, use
[`examples/nextjs`](../../examples/nextjs). Public API documentation lives at
[docs.creem.io/code/sdks/better-auth](https://docs.creem.io/code/sdks/better-auth).

## Setup

This test fixture has its own `package-lock.json` and is not a member of the repository's pnpm
workspaces. First install the repository workspace dependencies from the repository root so the
parent Better Auth package can build:

```bash
pnpm install --frozen-lockfile
```

Then run the fixture's own commands with npm:

```bash
cd packages/integrations/better-auth/test/nextjs-app
npm install
npm run build:plugin
cp .env.example .env.local
```

Generate a Better Auth secret and add it to `.env.local`:

```bash
openssl rand -base64 32
```

Fill in the remaining values with credentials from the Creem test environment. Create or update
the SQLite schema from the current Better Auth and Creem plugin configuration:

```bash
npm run db:migrate
```

Run this command again whenever the Better Auth configuration or its plugins change. Then replace
the placeholder product IDs in `src/app/pricing/page.tsx` and start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable               | Required       | Purpose                                                     |
| ---------------------- | -------------- | ----------------------------------------------------------- |
| `BETTER_AUTH_SECRET`   | Yes            | Secret used by Better Auth.                                 |
| `BETTER_AUTH_URL`      | Yes            | Local application origin, normally `http://localhost:3000`. |
| `CREEM_API_KEY`        | For billing    | API key from the Creem test environment.                    |
| `CREEM_WEBHOOK_SECRET` | For webhooks   | Signing secret for the registered test webhook.             |
| `CREEM_TEST_MODE`      | Yes            | Keep `true` when using test credentials.                    |
| `GITHUB_CLIENT_ID`     | No             | Enables the optional GitHub sign-in provider.               |
| `GITHUB_CLIENT_SECRET` | With client ID | Secret for the optional GitHub provider.                    |

## Manual test flows

### Authentication and access

1. Create an account at `/auth/signup`.
2. Sign in at `/auth/signin`.
3. Open `/dashboard` and confirm that a user without a subscription has no access.

### Checkout and synchronization

1. Open `/pricing` and start checkout with a test product.
2. Complete the Creem test checkout.
3. Confirm the redirect to `/success`.
4. Wait for the webhook, then confirm `/dashboard` shows the persisted subscription.
5. Check the server output for the `onGrantAccess` callback.

### Billing management

1. Open `/portal` and launch the Creem customer portal.
2. Open `/transactions` and confirm the signed-in customer's transaction history loads.
3. Cancel or pause a test subscription and confirm the corresponding webhook updates local state.

## Webhooks during local development

Expose port 3000 through an HTTPS tunnel and register the following URL in the Creem test-mode
dashboard:

```text
https://your-tunnel.example/api/auth/creem/webhook
```

The separate `/api/webhook/creem` route is deliberately an unverified demonstration endpoint. Do
not register or copy it into production code; the Better Auth plugin route verifies the webhook
signature and performs synchronization.

## Useful commands

```bash
npm run build:plugin  # rebuild the parent package
npm run db:migrate    # apply the current Better Auth and plugin schema
npm run dev           # start Next.js in development mode
npm run build         # create a production build of the harness
```

The SQLite database is created as `auth.db` in this directory and is ignored by Git. To reset local
state, stop the app, remove that local database, and run `npm run db:migrate` before starting the
app again.

## Troubleshooting

If an import cannot be resolved, run `npm run build:plugin` and restart Next.js. If billing features
are disabled, check that `CREEM_API_KEY` is set and is not the placeholder value. If webhooks do not
arrive, verify the public tunnel URL, signing secret, and environment mode in the Creem dashboard.
