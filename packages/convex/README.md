# Convex Creem Component

Add subscriptions, one-time purchases, and billing to your Convex app with
[Creem](https://www.creem.io).

**Check out the [Svelte example](example-svelte) and
[React example](example-react) for complete integrations.**

## Table of Contents

- [Quick Start — Backend](#quick-start--backend)
  - [1. Install](#1-install)
  - [2. Register component](#2-register-component)
  - [3. Set environment variables](#3-set-environment-variables)
  - [4. Configure billing](#4-configure-billing)
  - [5. Register webhooks](#5-register-webhooks)
  - [6. Sync products](#6-sync-products)
- [Quick Start — Frontend (UI Widgets)](#quick-start--frontend-ui-widgets)
  - [7. Install Tailwind CSS](#7-Install-UI-primitives)
  - [8. Install Tailwind CSS](#8-install-tailwind-css)
  - [9. Import styles](#9-import-styles)
- [Entity Model](#entity-model)
- [Scenarios](#scenarios)
  - [Wire the billing API](#wire-the-billing-api)
  - [1. Subscriptions](#1-subscriptions)
  - [2. Products](#2-products)
  - [3. Billing Portal](#3-billing-portal)
  - [4. Feature Gating](#4-feature-gating)
  - [5. Checkout Success](#5-checkout-success)
- [Advanced](#advanced)
  - [Webhook event middleware](#webhook-event-middleware)
  - [Security & Access Control](#security--access-control)
  - [Custom billing UI model](#custom-billing-ui-model)
  - [Server endpoint overrides](#server-endpoint-overrides)
- [API Reference](#api-reference)
  - [Resource namespaces](#resource-namespaces--creemnamespace)
  - [`creem.api({ resolve })` — convenience exports](#creemapi-resolve---convenience-exports)
  - [Infrastructure](#infrastructure)
  - [Direct API access — `creem.sdk.*`](#direct-api-access--creemsdk)
- [Component Reference](#component-reference)
  - [Widgets](#widgets)
  - [Presentational components](#presentational-components)
- [Troubleshooting](#troubleshooting)

---

## Quick Start — Backend

Complete these steps to use the billing API from your Convex functions. No
frontend framework required.

### 1. Install

```bash
npm install @creem_io/convex
```

### 2. Register component

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import creem from "@creem_io/convex/convex.config";

const app = defineApp();
app.use(creem);

export default app;
```

### 3. Set environment variables

```bash
npx convex env set CREEM_API_KEY <your_creem_api_key>
npx convex env set CREEM_WEBHOOK_SECRET <your_creem_webhook_signing_secret>
```

### 4. Configure billing

```ts
// convex/billing.ts
import { Creem, type ApiResolver } from "@creem_io/convex";
import { api, components } from "./_generated/api";
import { query, internalAction } from "./_generated/server";

export const creem = new Creem(components.creem);

// Auth resolver — replace with your own auth logic
const resolve: ApiResolver = async (ctx) => {
  const user = await ctx.runQuery(api.users.currentUser);
  return {
    userId: user._id,
    email: user.email,
    entityId: user._id, // For org billing: user.activeOrgId ?? user._id
  };
};

// Generate Convex function exports — each calls resolve(), then delegates
const {
  uiModel,
  snapshot,
  checkouts,
  subscriptions,
  products,
  customers,
  orders,
} = creem.api({ resolve });

export { uiModel, snapshot };
export const checkoutsCreate = checkouts.create;
export const subscriptionsUpdate = subscriptions.update;
export const subscriptionsCancel = subscriptions.cancel;
export const subscriptionsResume = subscriptions.resume;
export const subscriptionsPause = subscriptions.pause;
export const subscriptionsList = subscriptions.list;
export const subscriptionsListAll = subscriptions.listAll;
export const productsList = products.list;
export const productsGet = products.get;
export const customersRetrieve = customers.retrieve;
export const customersPortalUrl = customers.portalUrl;
export const ordersList = orders.list;

// Sync products from Creem (CLI / dashboard only)
export const syncBillingProducts = internalAction({
  args: {},
  handler: async (ctx) => {
    await creem.syncProducts(ctx);
  },
});
```

### 5. Register webhooks

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { creem } from "./billing";

const http = httpRouter();

creem.registerRoutes(http);

export default http;
```

Use your **Convex site URL** + `/creem/events` as the webhook endpoint in your
Creem dashboard. The component automatically handles `checkout.completed`,
`subscription.*`, and `product.*` events.

> For custom event handlers (e.g. sending emails on checkout), see
> [Webhook event middleware](#webhook-event-middleware).

### 6. Sync products

After configuring webhooks, pull your Creem products into the Convex database:

```bash
npx convex run billing:syncBillingProducts
```

> This is an `internalAction` — it can only be triggered from the CLI or the
> Convex dashboard.

**You're done with the backend.** You can now call `api.billing.*` from your
frontend or other Convex functions. If you only need the API (no UI widgets),
skip ahead to the [API Reference](#api-reference).

---

## Quick Start — Frontend (UI Widgets)

The component ships pre-built Svelte and React widgets that handle checkout,
plan switching, cancellation, seat management, and billing state — all connected
to Convex. Complete these three extra steps to use them.

### 7. Install UI primitives

The widgets are built on [Ark UI](https://ark-ui.com) headless primitives.
Install the adapter for your framework:

**React**

```sh
npm install @ark-ui/react
```

**Svelte**

```sh
npm install @ark-ui/svelte
```

### 8. Install Tailwind CSS

The widgets use [Tailwind CSS v4](https://tailwindcss.com/docs/installation). If
your project doesn't have Tailwind yet, install it following the
[official guide](https://tailwindcss.com/docs/installation).

### 9. Import styles

Add the component's design system import to your CSS entry point, **after** the
Tailwind import:

```css
@import "tailwindcss";
@import "@creem_io/convex/styles";
```

This registers the component's design tokens, base styles, and `@source`
directives so Tailwind scans the library's component files automatically.

**You're ready to use the UI widgets.** Continue with the scenarios below.

---

## Entity Model

By default, billing is scoped to the **authenticated user** — the `entityId`
returned from your resolver is used as the billing entity. All
`creem.api({ resolve })` functions, checkout metadata, and webhook resolution
automatically use this entity.

For **organization or team billing**, return the org ID as `entityId`:

```ts
const resolve: ApiResolver = async (ctx) => {
  const user = await ctx.runQuery(api.users.currentUser);
  const org = await ctx.runQuery(api.orgs.getActiveOrg);
  return {
    userId: user._id,
    email: user.email,
    entityId: org?._id ?? user._id, // org billing or personal billing
  };
};
```

All billing operations scope to the `entityId`. Webhooks resolve
`convexBillingEntityId` from checkout metadata (falls back to `convexUserId`).
No other code changes needed.

For access control details, see
[Security & Access Control](#security--access-control).

---

## Scenarios

Both Svelte and React widgets share **identical props and APIs** — only the
import path and framework boilerplate differ.

> **Convention:** Where the markup is identical in both frameworks, examples are
> shown once. The only recurring difference is `class=` (Svelte) vs `className=`
> (React) when passing CSS classes. Where Svelte and React syntax diverges (e.g.
> children rendering), both versions are shown.

### Wire the billing API

Every widget needs a `ConnectedBillingApi` object. Create it once in your layout
or page component:

**Svelte**

```svelte
<script lang="ts">
  import { setupConvex } from "@mmailaender/convex-svelte";
  import {
    Subscription, Product, BillingPortal,
    type ConnectedBillingApi,
  } from "@creem_io/convex/svelte";
  import { api } from "../convex/_generated/api.js";

  setupConvex(import.meta.env.VITE_CONVEX_URL);

  const billingApi: ConnectedBillingApi = {
    uiModel: api.billing.uiModel,
    checkouts: { create: api.billing.checkoutsCreate },
    subscriptions: {
      update: api.billing.subscriptionsUpdate,
      cancel: api.billing.subscriptionsCancel,
      resume: api.billing.subscriptionsResume,
    },
    customers: { portalUrl: api.billing.customersPortalUrl },
  };
</script>
```

**React**

```tsx
import {
  Subscription,
  Product,
  BillingPortal,
  type ConnectedBillingApi,
} from "@creem_io/convex/react";
import { api } from "../convex/_generated/api";

const billingApi: ConnectedBillingApi = {
  uiModel: api.billing.uiModel,
  checkouts: { create: api.billing.checkoutsCreate },
  subscriptions: {
    update: api.billing.subscriptionsUpdate,
    cancel: api.billing.subscriptionsCancel,
    resume: api.billing.subscriptionsResume,
  },
  customers: { portalUrl: api.billing.customersPortalUrl },
};
```

> The `ConnectedBillingApi` object is the same shape in both frameworks. Only
> the Convex client setup differs: `setupConvex()` in Svelte vs
> `<ConvexProvider>` in React (see
> [@mmailaender/convex-svelte](https://github.com/mmailaender/convex-svelte) and
> [convex/react](https://docs.convex.dev/client/react) docs).

### 1. Subscriptions

#### 1.1 Standard subscription plans

A typical pricing page with Free / Basic / Premium / Enterprise tiers. The
billing toggle auto-derives from the cycles present in registered plans.

```svelte
<Subscription.Root api={billingApi}>
  <Subscription.Item type="free" title="Free" description="Up to 3 users" />
  <Subscription.Item
    planId="basic"
    type="single"
    productIds={{
      "every-month": "prod_basic_monthly",
      "every-year": "prod_basic_yearly",
    }}
  />
  <Subscription.Item
    planId="premium"
    type="single"
    recommended
    productIds={{
      "every-month": "prod_premium_monthly",
      "every-year": "prod_premium_yearly",
    }}
  />
  <Subscription.Item
    type="enterprise"
    title="Enterprise"
    contactUrl="https://example.com/sales"
  />
</Subscription.Root>
<BillingPortal api={billingApi} />
```

**What you get:**

- Pricing cards with auto-resolved titles, descriptions (rendered as Markdown),
  and prices from Creem product data
- Billing cycle toggle (monthly/yearly) — hidden when all plans share a single
  cycle
- "Current plan" badge on the active subscription
- Plan switching with confirmation dialog
- Trial countdown badge
- Cancel / resume subscription (with confirmation dialog)
- Scheduled cancellation banner with "Undo" button

#### 1.2 Seat-based subscriptions

Two workflows for seat-based pricing:

**User-selectable seats** — the customer picks a quantity before checkout:

```svelte
<Subscription.Root api={billingApi} showSeatPicker>
  <Subscription.Item
    type="seat-based"
    productIds={{ "every-month": "prod_team_monthly" }}
  />
  <Subscription.Item
    type="seat-based"
    productIds={{ "every-month": "prod_business_monthly" }}
  />
</Subscription.Root>
```

**Auto-derived seats** — pass a fixed count (e.g. org member count) to checkout:

```svelte
<Subscription.Root api={billingApi} units={orgMemberCount}>
  <Subscription.Item
    type="seat-based"
    productIds={{ "every-month": "prod_team_monthly" }}
  />
</Subscription.Root>
```

When `subscriptions.update` is provided in the API, active seat-based plans show
a "Change seats" control.

> **Tip:** For auto-derived seats, keep the subscription in sync with your data.
> When your member count changes, call `subscriptions.update` with the new
> `units` so the billing reflects the current seat count.

### 2. Products

#### 2.1 Single one-time product

A standalone product purchased once. Shows "Owned" after purchase:

```svelte
<Product.Root api={billingApi}>
  <Product.Item type="one-time" productId="prod_license" />
</Product.Root>
```

#### 2.2 Repeating product (consumable)

Can be purchased multiple times — no "Owned" badge:

```svelte
<Product.Root api={billingApi}>
  <Product.Item type="recurring" productId="prod_credits" title="100 Credits" />
</Product.Root>
```

#### 2.3 Mutually exclusive product group

Use the `transition` prop to define upgrade paths between products. When the
user owns a lower-tier product, only valid upgrade paths are shown:

```svelte
<Product.Root
  api={billingApi}
  transition={[
    {
      from: "prod_basic_license",
      to: "prod_premium_license",
      kind: "via_product",
      viaProductId: "prod_basic_to_premium_upgrade",
    },
  ]}
>
  <Product.Item type="one-time" productId="prod_basic_license" />
  <Product.Item type="one-time" productId="prod_premium_license" />
</Product.Root>
```

**Transition kinds:**

- **`via_product`** — checkout uses a dedicated upgrade product (delta pricing)
- **`direct`** — checkout uses the target product directly

### 3. Billing Portal

`<BillingPortal>` opens the Creem customer billing portal. It auto-hides when
the billing entity has no Creem customer record.

Pass `permissions` to control who can access the portal (e.g. only admins):

```svelte
<BillingPortal api={billingApi} permissions={{ canAccessPortal: isAdmin }} />
```

```svelte
<!-- After a subscription group -->
<BillingPortal api={billingApi} />

<!-- Standalone with custom label -->
<BillingPortal api={billingApi}>Manage billing & invoices</BillingPortal>
```

### 4. Feature Gating

Use `BillingGate` to conditionally render UI based on available billing actions:

**Svelte**

```svelte
<BillingGate snapshot={billingSnapshot} requiredActions="portal">
  {#snippet children()}
    <p>You have portal access.</p>
  {/snippet}
  {#snippet fallback()}
    <p>Upgrade to access the billing portal.</p>
  {/snippet}
</BillingGate>
```

**React**

```tsx
<BillingGate
  snapshot={billingSnapshot}
  requiredActions="portal"
  fallback={<p>Upgrade to access the billing portal.</p>}
>
  <p>You have portal access.</p>
</BillingGate>
```

Available actions: `checkout`, `portal`, `cancel`, `reactivate`,
`switch_interval`, `update_seats`, `contact_sales`.

### 5. Checkout Success

Show a confirmation banner when the user returns from checkout. The component
parses Creem's query parameters automatically:

```svelte
<CheckoutSuccessSummary />
```

---

## Advanced

### Webhook event middleware

`registerRoutes` accepts an optional `events` object to run app-specific logic
alongside the component's automatic handling:

```ts
creem.registerRoutes(http, {
  path: "/creem/events", // default
  events: {
    "checkout.completed": async (ctx, event) => {
      // ctx is a Convex mutation context
      // event has { type, data } from Creem
      // Example: send confirmation email, grant entitlements, log analytics
    },
    "subscription.updated": async (ctx, event) => {
      const data = event.data as { customerCancellationReason?: string };
      if (data?.customerCancellationReason) {
        console.log("Cancellation reason:", data.customerCancellationReason);
      }
    },
  },
});
```

Your handlers run **after** the component's built-in processing
(customer/subscription/order upserts). The `ctx` is a Convex mutation context —
you can read/write to your own tables.

**Supported events:** `checkout.completed`, `subscription.active`,
`subscription.updated`, `subscription.canceled`, `subscription.paused`,
`subscription.resumed`, `product.created`, `product.updated`.

### Security & Access Control

**Auth is the app's responsibility.** The component is a sync engine — it reads
from Convex DB and writes to the Creem API. Every class method takes explicit
args; there is no hidden auth layer.

**Choose your approach:**

- **Quick start** — use [`creem.api({ resolve })`](#4-configure-billing) to
  generate ready-to-export Convex functions. Each one calls your `resolve`
  callback to authenticate and determine the `entityId`. The billing entity is
  derived from the authenticated session, never from client input. See
  [Step 4: Configure billing](#4-configure-billing) and the
  [`creem.api({ resolve })` reference](#creemapi-resolve---convenience-exports).

- **Full control** — use the
  [resource namespaces](#resource-namespaces--creemnamespace)
  (`creem.subscriptions.*`, `creem.checkouts.*`, etc.) directly in your own
  Convex functions. You handle auth, entity resolution, and permission checks
  yourself.

  The library exports **shared arg validators** that match exactly what the
  connected widgets send. Use them to keep your custom functions in sync:

  | Export                   | Used by                                          |
  | ------------------------ | ------------------------------------------------ |
  | `checkoutCreateArgs`     | `<Subscription.Root>`, `<Product.Root>`          |
  | `subscriptionUpdateArgs` | `<Subscription.Root>` (plan switch, seat update) |
  | `subscriptionCancelArgs` | `<Subscription.Root>` (cancel button)            |
  | `subscriptionResumeArgs` | `<Subscription.Root>` (resume button)            |
  | `subscriptionPauseArgs`  | `<Subscription.Root>` (pause button)             |

  Example:

```ts
// convex/billing.ts
import {
  Creem,
  checkoutCreateArgs,
  subscriptionCancelArgs,
} from "@creem_io/convex";
import { ConvexError } from "convex/values";
import { action, mutation } from "./_generated/server";
import { api, components } from "./_generated/api";

const creem = new Creem(components.creem);

async function resolveAuth(ctx) {
  const session = await ctx.runQuery(api.auth.getSession);
  if (!session) throw new ConvexError("Not authenticated");
  const org = await ctx.runQuery(api.orgs.getActiveOrg);
  return {
    userId: session.userId,
    email: session.user.email,
    entityId: org?._id ?? session.userId,
    role: session.user.role,
  };
}

// Admin-only: create checkout
export const checkoutsCreate = action({
  args: checkoutCreateArgs,
  handler: async (ctx, args) => {
    const auth = await resolveAuth(ctx);
    if (auth.role !== "admin") throw new ConvexError("Forbidden");
    return await creem.checkouts.create(ctx, {
      entityId: auth.entityId,
      userId: auth.userId,
      email: auth.email,
      ...args,
    });
  },
});

// Admin-only: cancel subscription
export const subscriptionsCancel = mutation({
  args: subscriptionCancelArgs,
  handler: async (ctx, args) => {
    const auth = await resolveAuth(ctx);
    if (auth.role !== "admin") throw new ConvexError("Forbidden");
    await creem.subscriptions.cancel(ctx, { entityId: auth.entityId, ...args });
  },
});
```

**UI-side permissions** — `BillingPermissions` controls which buttons are
enabled in the widgets. This is cosmetic gating only; enforce real permissions
server-side.

```ts
type BillingPermissions = {
  canCheckout?: boolean;
  canChangeSubscription?: boolean;
  canCancelSubscription?: boolean;
  canResumeSubscription?: boolean;
  canUpdateSeats?: boolean;
  canAccessPortal?: boolean;
};
```

```svelte
<script lang="ts">
  const isAdmin = $derived(currentUser?.role === "admin" || currentUser?.role === "owner");
  const permissions = $derived({
    canCheckout: isAdmin,
    canChangeSubscription: isAdmin,
    canCancelSubscription: isAdmin,
    canResumeSubscription: isAdmin,
    canUpdateSeats: isAdmin,
  });
</script>

<Subscription.Root api={billingApi} {permissions}>
  ...
</Subscription.Root>
```

When a permission is `false`, the button renders as disabled (greyed out). When
omitted or `undefined`, all actions default to enabled.

### Pre-checkout gate — `onBeforeCheckout`

Both `<Subscription.Root>` and `<Product.Root>` accept an `onBeforeCheckout`
callback that fires **before** the widget calls `checkouts.create`. Return
`true` to proceed, `false` to abort silently.

This is a generic hook — use it for authentication gates, terms acceptance,
confirmation dialogs, analytics, or any logic that must run before checkout.

```svelte
<Subscription.Root
  api={billingApi}
  onBeforeCheckout={(intent) => {
    if (!currentUser) {
      pendingCheckout.save(intent);
      openSignInDialog();
      return false;
    }
    return true;
  }}
>
  ...
</Subscription.Root>
```

**`CheckoutIntent`** — the object passed to the callback:

```ts
type CheckoutIntent = {
  productId: string;
  units?: number;
};
```

#### Auto-resume after sign-in

The widget automatically resumes a pending checkout when the user becomes
authenticated. The full flow:

1. Unauthenticated user clicks "Subscribe" → `onBeforeCheckout` fires
2. Your callback saves the intent via `pendingCheckout.save(intent)`, opens your
   sign-in dialog/redirect, and returns `false`
3. After sign-in, the Convex query re-fires → `model.user` becomes non-null
4. The widget detects the pending checkout and auto-triggers `checkouts.create`

This works for both **modal auth** (Clerk, Auth0 popup) and **redirect auth**
(OAuth) — no manual resume code needed.

**Safety:** The widget skips auto-resume if the user already has an active
subscription (`<Subscription.Root>`) or already owns the product
(`<Product.Root>`), preventing duplicate purchases after sign-in.

`pendingCheckout` is a tiny sessionStorage-based helper exported from the
library:

```ts
import { pendingCheckout } from "@creem_io/convex/svelte";

pendingCheckout.save(intent); // store before sign-in
pendingCheckout.load(); // read + auto-clear (used internally by widgets)
pendingCheckout.clear(); // manual clear if needed
```

### Custom billing UI model

`uiModel` (from `creem.api({ resolve })`) returns everything the connected
widgets need. If you need app-specific fields, write your own query using
`creem.getBillingModel()`:

```ts
import { query } from "./_generated/server";

export const getCustomBillingModel = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    const billingData = await creem.getBillingModel(ctx, {
      entityId: user?._id ?? null,
      user: user ? { _id: user._id, email: user.email } : null,
    });
    return {
      ...billingData,
      teamSize: user?.teamSize,
      featureFlags: user?.featureFlags,
    };
  },
});
```

### Server endpoint overrides

Only needed for non-default API endpoints (e.g. test/staging):

```bash
npx convex env set CREEM_SERVER_IDX <index>
# or
npx convex env set CREEM_SERVER_URL <url>
```

Leave both unset to use the default Creem production endpoint.

---

## API Reference

### Resource namespaces — `creem.<namespace>.*`

All methods take explicit arguments. Use them directly in your own Convex
functions, or let `creem.api({ resolve })` generate ready-to-export wrappers.

**`creem.subscriptions.*`**

| Method                                                                             | Data source | Description                                                                                                                                                       |
| ---------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.getCurrent(ctx, { entityId })`                                                   | Convex DB   | Current active subscription with product join                                                                                                                     |
| `.list(ctx, { entityId })`                                                         | Convex DB   | Active subscriptions (excludes ended + expired trials)                                                                                                            |
| `.listAll(ctx, { entityId })`                                                      | Convex DB   | All subscriptions including ended                                                                                                                                 |
| `.update(ctx, { entityId, subscriptionId?, productId?, units?, updateBehavior? })` | Creem API   | Unified plan switch (`productId`) or seat update (`units`). Pass `subscriptionId` when the entity has multiple active subscriptions. Optional proration override. |
| `.cancel(ctx, { entityId, revokeImmediately? })`                                   | Creem API   | Cancel subscription                                                                                                                                               |
| `.pause(ctx, { entityId })`                                                        | Creem API   | Pause an active subscription                                                                                                                                      |
| `.resume(ctx, { entityId })`                                                       | Creem API   | Resume a paused or scheduled-cancel subscription                                                                                                                  |

**`creem.checkouts.*`**

| Method                                                                                                              | Data source | Description                                                                  |
| ------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `.create(ctx, { entityId, userId, email, productId, successUrl?, fallbackSuccessUrl?, units?, metadata?, theme? })` | Creem API   | Create checkout URL with 3-tier `successUrl` resolution and optional `theme` |

**`creem.products.*`**

| Method                     | Data source | Description                                         |
| -------------------------- | ----------- | --------------------------------------------------- |
| `.list(ctx, options?)`     | Convex DB   | All synced products (public — no `entityId` needed) |
| `.get(ctx, { productId })` | Convex DB   | Single product by ID (public)                       |

**`creem.customers.*`**

| Method                          | Data source | Description                 |
| ------------------------------- | ----------- | --------------------------- |
| `.retrieve(ctx, { entityId })`  | Convex DB   | Customer record by entity   |
| `.portalUrl(ctx, { entityId })` | Creem API   | Customer billing portal URL |

**`creem.orders.*`**

| Method                     | Data source | Description          |
| -------------------------- | ----------- | -------------------- |
| `.list(ctx, { entityId })` | Convex DB   | Paid one-time orders |

**Composite helpers (top-level methods)**

| Method                                            | Description                                                                                                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `creem.getBillingModel(ctx, { entityId, user? })` | Aggregates snapshot + products + subscriptions + orders into a single object for widgets. Graceful when `entityId` is null (returns public catalog only). |
| `creem.getBillingSnapshot(ctx, { entityId })`     | Resolved billing state (plan, status, available actions). Uses `resolvePlan` override if configured, otherwise built-in resolver.                         |

### `creem.api({ resolve })` — convenience exports

Generates ready-to-export Convex function definitions. Each function calls your
`resolve` callback, then delegates to the corresponding namespace method.

| Export                  | Wraps                   | Type   | Description                                                                        |
| ----------------------- | ----------------------- | ------ | ---------------------------------------------------------------------------------- |
| `uiModel`               | `getBillingModel`       | query  | Calls `resolve()`, then `getBillingModel`. Graceful when unauthenticated.          |
| `snapshot`              | `getBillingSnapshot`    | query  | Calls `resolve()`, then `getBillingSnapshot`. Returns `null` when unauthenticated. |
| `checkouts.create`      | `checkouts.create`      | action | Auto-resolves auth                                                                 |
| `subscriptions.update`  | `subscriptions.update`  | action | Auto-resolves auth                                                                 |
| `subscriptions.cancel`  | `subscriptions.cancel`  | action | Auto-resolves auth                                                                 |
| `subscriptions.resume`  | `subscriptions.resume`  | action | Auto-resolves auth                                                                 |
| `subscriptions.pause`   | `subscriptions.pause`   | action | Auto-resolves auth                                                                 |
| `subscriptions.list`    | `subscriptions.list`    | query  | Auto-resolves auth                                                                 |
| `subscriptions.listAll` | `subscriptions.listAll` | query  | Auto-resolves auth                                                                 |
| `products.list`         | `products.list`         | query  | Public, no auth needed                                                             |
| `products.get`          | `products.get`          | query  | Public, no auth needed                                                             |
| `customers.retrieve`    | `customers.retrieve`    | query  | Auto-resolves auth                                                                 |
| `customers.portalUrl`   | `customers.portalUrl`   | action | Auto-resolves auth                                                                 |
| `orders.list`           | `orders.list`           | query  | Auto-resolves auth                                                                 |

### Infrastructure

| Method                                           | Description                                 |
| ------------------------------------------------ | ------------------------------------------- |
| `creem.syncProducts(ctx)`                        | Pull products from Creem API into Convex DB |
| `creem.registerRoutes(http, { path?, events? })` | Register webhook HTTP routes                |

### Direct API access — `creem.sdk.*`

The resource namespaces above cover all **billing features that stay in sync**
with Convex via webhooks. Some Creem API resources have no webhook support, so
the component cannot mirror them in Convex DB. For these, use `creem.sdk.*`
directly inside your own Convex actions — it's the same Creem SDK client,
already configured with your API key:

| Resource         | Synced to Convex?    | Access                     |
| ---------------- | -------------------- | -------------------------- |
| Subscriptions    | Yes (webhook)        | `creem.subscriptions.*`    |
| Checkouts        | Yes (webhook)        | `creem.checkouts.*`        |
| Products         | Yes (webhook + sync) | `creem.products.*`         |
| Customers        | Yes (webhook)        | `creem.customers.*`        |
| Orders           | Yes (webhook)        | `creem.orders.*`           |
| **Licenses**     | No webhook           | `creem.sdk.licenses.*`     |
| **Discounts**    | No webhook           | `creem.sdk.discounts.*`    |
| **Transactions** | No webhook           | `creem.sdk.transactions.*` |

```ts
import { action } from "./_generated/server";
import { v } from "convex/values";

// Example: create a discount (not synced — Creem has no webhook for discounts)
export const createDiscount = action({
  args: { code: v.string(), percentage: v.number() },
  handler: async (ctx, args) => {
    return await creem.sdk.discounts.create({
      name: args.code,
      code: args.code,
      type: "percentage",
      percentage: args.percentage,
      duration: "forever",
      appliesTo: [],
    });
  },
});
```

---

## Component Reference

All components share **identical props** across Svelte and React.

- **Import:** `@creem_io/convex/svelte` or `@creem_io/convex/react`
- **CSS class prop:** `class` in Svelte, `className` in React
- **Children:** Svelte `Snippet` / React `ReactNode`
- **Svelte** components use Svelte 5 runes and snippet rendering
  (`{@render ...}`)

See the [Svelte example](example-svelte) and [React example](example-react) for
complete integrations.

### Widgets

These query Convex directly and manage billing state end-to-end.

#### `<Subscription.Root>`

Container for subscription plan cards. Handles billing cycle toggle, checkout,
plan switching, cancellation, and seat management.

| Prop                | Type                                                      | Default                                      | Description                                                                                                                                               |
| ------------------- | --------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api`               | `ConnectedBillingApi`                                     | —                                            | **Required.** Backend function references                                                                                                                 |
| `permissions`       | `BillingPermissions`                                      | all enabled                                  | Disable actions based on user role                                                                                                                        |
| `class`/`className` | `string`                                                  | `""`                                         | Wrapper CSS class                                                                                                                                         |
| `successUrl`        | `string`                                                  | product's `defaultSuccessUrl` → current page | Override redirect after checkout. When omitted, uses the product's `defaultSuccessUrl` from Creem; if that is also unset, falls back to the current page. |
| `units`             | `number`                                                  | —                                            | Auto-derived seat count for seat-based plans                                                                                                              |
| `showSeatPicker`    | `boolean`                                                 | `false`                                      | Show quantity picker on seat-based cards                                                                                                                  |
| `twoColumnLayout`   | `boolean`                                                 | `false`                                      | Use two-column card layout                                                                                                                                |
| `updateBehavior`    | `UpdateBehavior`                                          | `"proration-charge-immediately"`             | How plan switches and seat updates are billed. See below.                                                                                                 |
| `onBeforeCheckout`  | `(intent: CheckoutIntent) => Promise<boolean> \| boolean` | —                                            | Gate checkout (auth, terms, etc.). Return `false` to abort.                                                                                               |
| `children`          | `Snippet` / `ReactNode`                                   | —                                            | `<Subscription.Item>` children                                                                                                                            |

**`UpdateBehavior`** controls how the Creem API handles plan switches and seat
changes:

- `"proration-charge-immediately"` — prorate and charge the difference now
  (default)
- `"proration-charge"` — prorate, charge on next invoice
- `"proration-none"` — no proration, change takes effect on next billing cycle

#### `<Subscription.Item>`

Registers a plan inside `<Subscription.Root>`. Renders nothing on its own — the
root component renders the pricing cards.

| Prop          | Type                                                 | Default                    | Description                                                                                         |
| ------------- | ---------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| `type`        | `"free" \| "single" \| "seat-based" \| "enterprise"` | —                          | **Required.** Plan type                                                                             |
| `planId`      | `string`                                             | first product ID or `type` | Unique plan identifier                                                                              |
| `title`       | `string`                                             | from Creem product data    | Plan display title                                                                                  |
| `description` | `string`                                             | from Creem product data    | Plan subtitle (rendered as Markdown)                                                                |
| `contactUrl`  | `string`                                             | —                          | "Contact sales" link. **Required when `type="enterprise"`**.                                        |
| `recommended` | `boolean`                                            | `false`                    | Highlight as recommended plan                                                                       |
| `productIds`  | `Partial<Record<RecurringCycle, string>>`            | —                          | Creem product IDs keyed by billing cycle. **Required when `type="single"` or `type="seat-based"`**. |

**Supported billing cycles:** `every-month`, `every-three-months`,
`every-six-months`, `every-year`.

`Subscription` and `Subscription.Item` are aliases — use whichever reads better
in your markup.

#### `<Product.Root>`

Container for one-time or repeating product cards. Handles ownership tracking,
upgrade transitions, and checkout.

| Prop                | Type                                                      | Default                                      | Description                                                                                                                                               |
| ------------------- | --------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api`               | `ConnectedBillingApi`                                     | —                                            | **Required.** Backend function references                                                                                                                 |
| `permissions`       | `BillingPermissions`                                      | all enabled                                  | Disable actions based on user role                                                                                                                        |
| `transition`        | `Transition[]`                                            | `[]`                                         | Upgrade path rules between products                                                                                                                       |
| `class`/`className` | `string`                                                  | `""`                                         | Wrapper CSS class                                                                                                                                         |
| `layout`            | `"default" \| "single"`                                   | `"default"`                                  | Card layout mode                                                                                                                                          |
| `styleVariant`      | `"legacy" \| "pricing"`                                   | `"legacy"`                                   | Visual style variant                                                                                                                                      |
| `showImages`        | `boolean`                                                 | `false`                                      | Show product images on cards                                                                                                                              |
| `pricingCtaVariant` | `"filled" \| "faded"`                                     | `"faded"`                                    | Call-to-action button style                                                                                                                               |
| `successUrl`        | `string`                                                  | product's `defaultSuccessUrl` → current page | Override redirect after checkout. When omitted, uses the product's `defaultSuccessUrl` from Creem; if that is also unset, falls back to the current page. |
| `onBeforeCheckout`  | `(intent: CheckoutIntent) => Promise<boolean> \| boolean` | —                                            | Gate checkout (auth, terms, etc.). Return `false` to abort.                                                                                               |
| `children`          | `Snippet` / `ReactNode`                                   | —                                            | `<Product.Item>` children                                                                                                                                 |

**Transition types:**

```ts
type Transition =
  | { from: string; to: string; kind: "direct" }
  | { from: string; to: string; kind: "via_product"; viaProductId: string };
```

#### `<Product.Item>`

Registers a product inside `<Product.Root>`.

| Prop          | Type                        | Default                 | Description                                               |
| ------------- | --------------------------- | ----------------------- | --------------------------------------------------------- |
| `productId`   | `string`                    | —                       | **Required.** Creem product ID                            |
| `type`        | `"one-time" \| "recurring"` | —                       | **Required.** One-time shows "Owned" badge after purchase |
| `title`       | `string`                    | from Creem product data | Card display title                                        |
| `description` | `string`                    | from Creem product data | Card subtitle (rendered as Markdown)                      |

`Product` and `Product.Item` are aliases.

#### `<BillingPortal>`

Button that opens the Creem customer billing portal. Auto-hides when the billing
entity has no Creem customer record, or when `canAccessPortal` is `false`.

| Prop                | Type                    | Default            | Description                                               |
| ------------------- | ----------------------- | ------------------ | --------------------------------------------------------- |
| `api`               | `ConnectedBillingApi`   | —                  | **Required.** Backend function references                 |
| `permissions`       | `BillingPermissions`    | all enabled        | Control portal access (e.g. `{ canAccessPortal: false }`) |
| `class`/`className` | `string`                | `""`               | Button CSS class                                          |
| `children`          | `Snippet` / `ReactNode` | `"Manage billing"` | Custom button label                                       |

### Presentational components

Lower-level building blocks for custom layouts. These do **not** call Convex
directly — pass data and callbacks as props.

#### `<PricingSection>`

Renders a grid of pricing cards with an optional billing cycle toggle.

| Prop                    | Type                      | Description                           |
| ----------------------- | ------------------------- | ------------------------------------- |
| `plans`                 | `UIPlanEntry[]`           | Plan definitions                      |
| `snapshot`              | `BillingSnapshot \| null` | Current billing state                 |
| `selectedCycle`         | `RecurringCycle`          | Active billing cycle                  |
| `products`              | `ConnectedProduct[]`      | Product data for price resolution     |
| `subscriptionProductId` | `string \| null`          | Currently subscribed product          |
| `subscriptionStatus`    | `string \| null`          | Subscription status                   |
| `units`                 | `number`                  | Seat count                            |
| `showSeatPicker`        | `boolean`                 | Show quantity picker                  |
| `subscribedSeats`       | `number \| null`          | Current seat count                    |
| `isGroupSubscribed`     | `boolean`                 | Whether group has active subscription |
| `disableCheckout`       | `boolean`                 | Disable checkout buttons              |
| `disableSwitch`         | `boolean`                 | Disable plan switch buttons           |
| `disableSeats`          | `boolean`                 | Disable seat controls                 |
| `onCycleChange`         | `(cycle) => void`         | Billing cycle change handler          |
| `onCheckout`            | `(payload) => void`       | Checkout handler                      |
| `onSwitchPlan`          | `(payload) => void`       | Plan switch handler                   |
| `onUpdateSeats`         | `(payload) => void`       | Seat update handler                   |

#### `<PricingCard>`

A single plan card with price, description, and action button. Same props as
`<PricingSection>` for a single plan (see source for full list).

#### `<BillingToggle>`

Billing cycle segment control (e.g. Monthly / Yearly).

| Prop            | Type               | Description      |
| --------------- | ------------------ | ---------------- |
| `cycles`        | `RecurringCycle[]` | Available cycles |
| `value`         | `RecurringCycle`   | Selected cycle   |
| `onValueChange` | `(cycle) => void`  | Change handler   |
| `className`     | `string`           | CSS class        |

#### `<CheckoutButton>`

Styled checkout button. Supports both `onCheckout` callback and `href` link
modes.

| Prop         | Type                    | Description                        |
| ------------ | ----------------------- | ---------------------------------- |
| `productId`  | `string`                | Product ID                         |
| `href`       | `string`                | Link mode: direct URL              |
| `disabled`   | `boolean`               | Disable button                     |
| `className`  | `string`                | CSS class                          |
| `onCheckout` | `(payload) => void`     | Callback mode: `{ productId }`     |
| `children`   | `Snippet` / `ReactNode` | Button label (default: "Checkout") |

#### `<OneTimeCheckoutButton>`

Same as `<CheckoutButton>` with default label "Buy now".

#### `<CustomerPortalButton>`

Styled button for opening the customer billing portal.

| Prop           | Type                    | Description                              |
| -------------- | ----------------------- | ---------------------------------------- |
| `href`         | `string`                | Link mode: direct URL                    |
| `disabled`     | `boolean`               | Disable button                           |
| `className`    | `string`                | CSS class                                |
| `onOpenPortal` | `() => void`            | Callback mode                            |
| `children`     | `Snippet` / `ReactNode` | Button label (default: "Manage billing") |

#### `<BillingGate>`

Conditionally renders children based on available billing actions.

| Prop              | Type                                   | Description                             |
| ----------------- | -------------------------------------- | --------------------------------------- |
| `snapshot`        | `BillingSnapshot \| null`              | Current billing state                   |
| `requiredActions` | `AvailableAction \| AvailableAction[]` | Actions that must be available          |
| `children`        | `Snippet` / `ReactNode`                | Rendered when all actions are available |
| `fallback`        | `Snippet` / `ReactNode`                | Rendered otherwise                      |

#### `<CheckoutSuccessSummary>`

Displays a success banner after checkout. Parses Creem query params
automatically.

| Prop        | Type                    | Description                                                  |
| ----------- | ----------------------- | ------------------------------------------------------------ |
| `params`    | `CheckoutSuccessParams` | Manual params (overrides URL parsing)                        |
| `search`    | `string`                | Query string to parse (defaults to `window.location.search`) |
| `className` | `string`                | CSS class                                                    |

React also exports a `useCheckoutSuccessParams()` hook that returns the parsed
params directly.

#### `<TrialLimitBanner>`

Shows a trial expiration notice.

| Prop          | Type                      | Description             |
| ------------- | ------------------------- | ----------------------- |
| `snapshot`    | `BillingSnapshot \| null` | Current billing state   |
| `trialEndsAt` | `string \| null`          | Override trial end date |
| `className`   | `string`                  | CSS class               |

#### `<ScheduledChangeBanner>`

Shows a cancellation-scheduled notice with optional "Undo" button.

| Prop        | Type                      | Description                                       |
| ----------- | ------------------------- | ------------------------------------------------- |
| `snapshot`  | `BillingSnapshot \| null` | Current billing state                             |
| `isLoading` | `boolean`                 | Loading state for resume button                   |
| `onResume`  | `() => void`              | Resume handler (shows "Undo cancellation" button) |
| `className` | `string`                  | CSS class                                         |

#### `<PaymentWarningBanner>`

Shows a warning for pending, refunded, or partially refunded payments.

| Prop        | Type                      | Description           |
| ----------- | ------------------------- | --------------------- |
| `snapshot`  | `BillingSnapshot \| null` | Current billing state |
| `payment`   | `PaymentSnapshot \| null` | Override payment data |
| `className` | `string`                  | CSS class             |

#### `<OneTimePaymentStatusBadge>`

Inline status badge for one-time payments.

| Prop        | Type                                                        | Description    |
| ----------- | ----------------------------------------------------------- | -------------- |
| `status`    | `"pending" \| "paid" \| "refunded" \| "partially_refunded"` | Payment status |
| `className` | `string`                                                    | CSS class      |

---

## Troubleshooting

**Webhooks not receiving events** Verify your Creem dashboard webhook URL
matches `<CONVEX_SITE_URL>/creem/events`. Check that `CREEM_WEBHOOK_SECRET`
matches the signing secret in Creem. Check the Convex dashboard logs for
verification errors.

**Products not syncing** Run `npx convex run billing:syncBillingProducts` after
setting up webhooks. Ensure `CREEM_API_KEY` is set and the key has read access
to products.

**Widgets rendering unstyled** Ensure both Tailwind CSS v4 and
`@import "@creem_io/convex/styles"` are in your CSS entry point. The
styles import must come after the Tailwind import.

**Checkout URL missing from response** The Creem API returned no checkout URL.
Verify the product ID exists and is active in your Creem dashboard. Check the
Convex dashboard logs for the full error.

**Entity/org billing not scoping correctly** Ensure `billingEntityId` is
returned from `getUserInfo`. If omitted, `userId` is used as the billing entity.
Verify that checkout metadata includes `convexBillingEntityId` by checking
webhook logs.

**"Customer not found" when opening billing portal** The customer record is
created on first checkout. If the user hasn't completed a checkout yet, there's
no customer to link to the portal.
