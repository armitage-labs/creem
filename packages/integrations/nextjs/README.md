# `@creem_io/nextjs`

Checkout, customer portal, and verified webhook helpers for the Next.js App Router.

**Full documentation:**
[docs.creem.io/code/sdks/nextjs](https://docs.creem.io/code/sdks/nextjs)

## Install

```bash
pnpm add @creem_io/nextjs
```

Requires Next.js 13 or newer and React 18 or newer.

## Minimal setup

Create a checkout route:

```typescript
// app/checkout/route.ts
import { Checkout } from "@creem_io/nextjs";

export const GET = Checkout({
  apiKey: process.env.CREEM_API_KEY!,
  testMode: true,
  defaultSuccessUrl: "/billing/success",
});
```

Render a checkout link:

```tsx
import { CreemCheckout } from "@creem_io/nextjs";

export default function PricingPage() {
  return <CreemCheckout productId="prod_...">Subscribe</CreemCheckout>;
}
```

Handle webhooks:

```typescript
// app/api/webhook/creem/route.ts
import { Webhook } from "@creem_io/nextjs";

export const POST = Webhook({
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  onCheckoutCompleted: async ({ customer, product }) => {
    console.log(`${customer.email} purchased ${product.name}`);
  },
});
```

Callbacks must be idempotent because webhook deliveries can be retried.
Granting or revoking application access requires a trusted user ID; follow the authenticated
checkout pattern in the full guide before using the access callbacks.

## Exports

| Export          | Purpose                                                     |
| --------------- | ----------------------------------------------------------- |
| `CreemCheckout` | Builds a link to your checkout route.                       |
| `CreemPortal`   | Builds a link to your customer portal route.                |
| `Checkout`      | Creates checkout sessions and redirects to Creem.           |
| `Portal`        | Creates customer billing links and redirects to the portal. |
| `Webhook`       | Verifies and dispatches Creem webhook events.               |

See the [Next.js adapter guide](https://docs.creem.io/code/sdks/nextjs) for all props, route setup,
access callbacks, and security guidance.

## Example and development

- [Runnable example](example)
- [Contributing guide](../../../CONTRIBUTING.md)

From the repository root:

```bash
pnpm --filter @creem_io/nextjs build
pnpm --filter @creem_io/nextjs typecheck
pnpm --filter @creem_io/nextjs check:package
```

## License

[MIT](LICENSE)
