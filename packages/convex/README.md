# Convex Creem Component

Add subscriptions, one-time purchases, credits, and billing UI to your Convex
app with [Creem](https://www.creem.io).

Webhooks keep billing state synced into your Convex database. Pre-built React
and Svelte widgets cover checkout, plan switching, cancellation, and billing
history. They re-render as the underlying Convex data changes.

**Documentation lives at
[docs.creem.io/code/sdks/convex](https://docs.creem.io/code/sdks/convex/quickstart).**
This file is the npm and GitHub entry point: what the package is, the shortest
working example, and where to go next.

| I want to…                                        | Go to                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Get a pricing page working in five minutes        | [Quickstart](https://docs.creem.io/code/sdks/convex/quickstart)                            |
| Run a complete setup with an AI agent, or migrate | [Integration Guide](https://docs.creem.io/code/sdks/convex/integration)                    |
| Configure plans, cycles, trials, unit pricing     | [Subscriptions](https://docs.creem.io/code/sdks/convex/subscriptions)                      |
| Sell one-time products, consumables, credit packs | [One-Time Products & Credits](https://docs.creem.io/code/sdks/convex/one-time-and-credits) |
| Gate features and render account UI               | [Entitlements & Account UI](https://docs.creem.io/code/sdks/convex/entitlements)           |
| Understand the entity and state model             | [Concepts](https://docs.creem.io/code/sdks/convex/concepts)                                |
| Do custom auth/RBAC, webhook middleware, i18n     | [Advanced](https://docs.creem.io/code/sdks/convex/advanced)                                |
| Look up an API method or a widget prop            | [Component Reference](https://docs.creem.io/code/sdks/convex/reference)                    |

Working integrations: [Svelte example](example-svelte),
[React example](example-react). Repository-only demo backend notes:
[convex/README.md](convex/README.md). Contributing to this package:
[AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Install

```bash
pnpm install @creem_io/convex convex creem
```

Plus the UI peer dependencies for your framework:

```bash
pnpm install @ark-ui/react                 # React
pnpm install convex-svelte @ark-ui/svelte  # Svelte
```

The widgets require
[Tailwind CSS v4](https://tailwindcss.com/docs/installation).

---

## Shortest working setup

**1. Register the component**

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import creem from "@creem_io/convex/convex.config";

const app = defineApp();
app.use(creem);

export default app;
```

```bash
npx convex env set CREEM_API_KEY <your_creem_api_key>
npx convex env set CREEM_WEBHOOK_SECRET <your_creem_webhook_signing_secret>
npx convex env set CREEM_SERVER test
```

**2. Export the billing API**

```ts
// convex/billing.ts
import { Creem, type ApiResolver } from "@creem_io/convex";
import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const creem = new Creem(components.creem);

// Return `null` for an unauthenticated caller. Public pricing pages rely on
// that. Anything thrown here counts as a real failure and propagates.
const resolve: ApiResolver = async (ctx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return {
    userId: identity.subject,
    email: identity.email!,
    entityId: identity.subject, // for org billing, return the verified org ID
  };
};

const { uiModel, checkouts, subscriptions, customers } = creem.api({ resolve });

export { uiModel };
export const checkoutsCreate = checkouts.create;
export const subscriptionsUpdate = subscriptions.update;
export const subscriptionsCancel = subscriptions.cancel;
export const subscriptionsResume = subscriptions.resume;
export const customersPortalUrl = customers.portalUrl;

export const syncBillingProducts = internalAction({
  args: {},
  handler: async (ctx) => {
    await creem.syncProducts(ctx);
  },
});
```

**3. Register the webhook**

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { creem } from "./billing";

const http = httpRouter();
creem.registerRoutes(http);
export default http;
```

Point your Creem dashboard webhook at `<your-convex-site-url>/creem/events`,
then sync products once:

```bash
npx convex run billing:syncBillingProducts
```

**4. Render the UI**

```css
/* your CSS entry point */
@import "tailwindcss";
@import "@creem_io/convex/styles";
```

```tsx
import {
  CreemConvexProvider,
  Subscription,
  BillingPortal,
  connectCreemApi,
} from "@creem_io/convex/react"; // or /svelte
import { api } from "../convex/_generated/api";

// Maps the generated export names onto the widget API. A missing or mis-wired
// export is a compile error, not a blank widget.
const billingApi = connectCreemApi(api.billing);

export function PricingPage() {
  return (
    <CreemConvexProvider api={billingApi} catalog={billingCatalog}>
      <Subscription.Root plans={["basic", "premium"]} />
      <BillingPortal />
    </CreemConvexProvider>
  );
}
```

That gives you live prices, checkout, a "Current plan" badge, plan switching,
and cancel/resume. Trials, unit pricing, groups, credits, feature gating, custom
card composition, and RBAC are covered in the
[docs](https://docs.creem.io/code/sdks/convex/quickstart).

---

## Migrating

Upgrading from 0.3.x? See
[Migration](https://docs.creem.io/code/sdks/convex/migration) for the full
old-API to new-API tables.

## License

MIT
