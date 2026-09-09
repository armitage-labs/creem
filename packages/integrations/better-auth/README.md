# `@creem_io/better-auth`

Connect [Creem](https://www.creem.io) billing to a
[Better Auth](https://www.better-auth.com) application.

The plugin adds session-aware checkout, customer portal, subscription, and transaction endpoints.
Verified webhooks can keep subscription state in your Better Auth database and run your own access
provisioning callbacks.

**Full documentation:**
[docs.creem.io/code/sdks/better-auth](https://docs.creem.io/code/sdks/better-auth)

| I want to…                                     | Go to                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| Add the plugin to an application               | [Quickstart](https://docs.creem.io/code/sdks/better-auth/quickstart)        |
| Configure persistence and the database schema  | [Configuration](https://docs.creem.io/code/sdks/better-auth/configuration)  |
| Use checkout, portal, and subscription methods | [Client API](https://docs.creem.io/code/sdks/better-auth/client)            |
| Synchronize billing and provision access       | [Webhooks and access](https://docs.creem.io/code/sdks/better-auth/webhooks) |
| Call Creem from trusted server code            | [Server API](https://docs.creem.io/code/sdks/better-auth/server)            |

## Install

```bash
pnpm add @creem_io/better-auth better-auth
```

The plugin supports Better Auth `^1.3.34` and Zod 3 or 4. The Creem TypeScript SDK is included.

## Minimal setup

Register the server plugin:

```typescript
// lib/auth.ts
import { creem } from "@creem_io/better-auth";
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: {
    // Your Better Auth database configuration
  },
  plugins: [
    creem({
      apiKey: process.env.CREEM_API_KEY!,
      webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
      testMode: true,
      defaultSuccessUrl: "/billing/success",
      persistSubscriptions: true,
    }),
  ],
});
```

Register the client plugin:

```typescript
// lib/auth-client.ts
import { creemClient } from "@creem_io/better-auth/client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [creemClient()],
});
```

When persistence is enabled, apply the plugin schema directly with Better Auth's built-in Kysely
adapter:

```bash
npx @better-auth/cli migrate
```

For Prisma, Drizzle, or another ORM-managed schema, run `npx @better-auth/cli generate` and apply
the result with the ORM's migration tooling.

Create a checkout for the signed-in user:

```typescript
const { data, error } = await authClient.creem.createCheckout({
  productId: "prod_...",
  successUrl: "/billing/success",
});

if (!error && data?.url) {
  window.location.assign(data.url);
}
```

Finally, register this URL as a webhook in the Creem dashboard:

```text
https://your-domain.com/api/auth/creem/webhook
```

The route is available only when `webhookSecret` is configured. `/api/auth` is Better Auth's
default base path.

## Client methods

- `createCheckout(input)`
- `createPortal(input?)`
- `cancelSubscription(input)`
- `retrieveSubscription(input)`
- `searchTransactions(input?)`
- `hasAccessGranted()`

See the [client API documentation](https://docs.creem.io/code/sdks/better-auth/client) for inputs,
results, and authorization notes.

## Examples and development

- [Next.js example](examples/nextjs)
- [Integration test harness](test/nextjs-app)
- [Architecture notes](docs/ARCHITECTURE.md)
- [Contributing guide](CONTRIBUTING.md)

From the repository root:

```bash
pnpm --filter @creem_io/better-auth build
pnpm --filter @creem_io/better-auth test
pnpm --filter @creem_io/better-auth typecheck
pnpm --filter @creem_io/better-auth check:package
```

## License

[MIT](LICENSE)
