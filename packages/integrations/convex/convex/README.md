# Convex Backend - `convex-creem`

This file documents only the repository's example Convex backend: its files,
environment, demo exports, and local operational commands. It is not the
consumer integration guide or package API reference. Use
[the Integration Guide](https://docs.creem.io/code/sdks/convex/integration) for
setup steps and [`../README.md`](../README.md) for the package entry point.

## Files

- `convex.config.ts` registers the `@creem_io/convex` component.
- `billing.ts` creates the `Creem` client, resolves the billing entity, exports
  generated billing functions, and contains demo credit actions.
- `http.ts` registers the Creem webhook route at `/creem/events`.
- `schema.ts` contains demo app tables. Replace the demo `users` lookup with
  your real auth or organization model.

## Required Convex Env Vars

```bash
npx convex env set CREEM_API_KEY <your_creem_api_key>
npx convex env set CREEM_WEBHOOK_SECRET <your_creem_webhook_signing_secret>
npx convex env set CREEM_SERVER test
```

The examples default to the Creem test server unless `CREEM_SERVER=prod` is set
in Convex env.

For the credit-pack demo, keep the trusted product ID in Convex env:

```bash
npx convex env set CREEM_ONETIME_CREDITS prod_...
```

Browser `VITE_*` variables are only for frontend widgets. Webhook fulfillment
must use server-side Convex env values.

## Billing API Exports

`billing.ts` uses:

```ts
const {
  uiModel,
  snapshot,
  checkouts,
  subscriptions,
  products,
  customers,
  transactions,
  plans,
  orders,
  credits,
} = creem.api({ resolve });
```

The public exports are then passed to frontend `ConnectedBillingApi` objects:

- `uiModel`
- `checkoutsCreate`
- `subscriptionsUpdate`
- `subscriptionsCancel`
- `subscriptionsResume`
- `subscriptionsCancelScheduledUpdate`
- `plansActivate`
- `customersPortalUrl`
- `transactionsSearch`
- `creditsGetBalance`

The connected credits widget only receives `creditsGetBalance`. Privileged
credit creation, grants, and spending stay in app-owned backend functions. The
entity-scoped `creditsListEntries` export exists for an app-specific history
view; it is not wired into the generic widgets. Additional SDK-mirrored reads
and subscription operations are available for app-specific backend flows.

## Product Sync

Creem product metadata must be synced into Convex before pricing widgets can
show product names, prices, descriptions, and images.

```bash
npx convex run billing:syncBillingProducts
```

`syncBillingProducts` is an `internalAction`. It is meant for the Convex CLI,
Convex dashboard, scheduled jobs, or trusted internal functions, not direct
browser calls.

## Webhooks

`http.ts` calls `creem.registerRoutes(http, { path: "/creem/events" })`.

Configure Creem to send webhooks to:

```text
https://<your-convex-site-url>/creem/events
```

The component handles supported checkout, subscription, refund, dispute, and
credit grant events. Add custom `events` handlers in `http.ts` for app-specific
side effects such as analytics, email, or audit logging.

## Auth Resolver

The example resolver calls the internal `billing.getUserInfo` query, which reads
the first row from the demo `users` table. Replace this with production auth:

```ts
const resolve: ApiResolver = async (ctx) => {
  const identity = await ctx.auth.getUserIdentity();
  // `null` means "no authenticated caller". Public pricing pages depend on it.
  if (!identity) return null;

  return {
    userId: identity.subject,
    email: identity.email!,
    entityId: identity.subject, // or the active org/team ID
  };
};
```

Return `null` for an anonymous caller. Anything thrown here counts as a real
failure. It is logged and rethrown rather than silently degrading a signed-in
user to the logged-out pricing page.

Use `entityId` for the billing owner. For team billing, verify that the
authenticated user belongs to the selected organization, and has the required
billing role, before returning the org ID.

## Demo Credit Spending

`generateDemoImage` demonstrates the right shape for app-owned credit spending:
the backend action resolves the entity and calls `creem.credits.debitForEntity`
with a server-controlled amount and reference. The frontend `Credits.Root` only
refreshes and displays the balance.
