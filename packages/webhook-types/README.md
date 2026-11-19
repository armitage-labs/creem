# `@creem_io/webhook-types`

Shared TypeScript types and utilities for Creem webhook payloads. Creem's
framework integrations use this package as their common webhook contract.

## Installation

```bash
pnpm add @creem_io/webhook-types
```

## Usage

```ts
import {
  isWebhookEventEntity,
  parseWebhookEvent,
  type WebhookEvent,
} from "@creem_io/webhook-types";

const event: WebhookEvent = parseWebhookEvent(requestBody);

if (isWebhookEventEntity(event)) {
  console.log(event.eventType, event.id);
}
```

The package exports webhook entity and event types, normalized event types,
runtime type guards, `generateSignature`, and `parseWebhookEvent`.

## Values Creem adds later

Value fields such as a refund's `reason` or a subscription's `status` are typed
as `OpenValue<Known>`: one of the values this version knows, or any other
string. Creem can add a value before you upgrade, and `parseWebhookEvent`
passes it through as sent, so a `switch` over the known values is not
exhaustive. A `never` exhaustiveness check doesn't compile without a `default`
branch, and neither does a function that returns from every case when its
return type is declared or `noImplicitReturns` is on. With an inferred return
type that function compiles and its return type gains `undefined`. A handler
that returns nothing compiles too, and a new value then matches no case, so
give these a `default` as well:

```ts
switch (refund.reason) {
  case "duplicate":
    break;
  default:
  // a reason added after this version
}
```

Comparisons with a known value compile and editors suggest the known values,
but a misspelled value (`refund.reason === "duplicat"`) compiles too, because
any string is allowed.

The fields that identify an event or an object (`eventType`, `object`) stay
closed.

## Event types Creem adds later

`parseWebhookEvent` accepts an event type this version doesn't know when its
`object` is of a kind it knows, and throws `Invalid webhook event` when the
`object` is of a new kind.

The webhook handlers in `@creem_io/better-auth` and `@creem_io/nextjs` don't
acknowledge such an event in this release. An unknown event type reaches their
`switch` default and gets a `400 Unknown event type`, and an event whose
`parseWebhookEvent` call throws gets a `500`. Either way Creem treats the
delivery as failed and retries it. `@creem_io/convex` acknowledges an event
type it doesn't know with a `202`, so Creem doesn't retry it.

## Development

From the repository root:

```bash
pnpm --filter @creem_io/webhook-types build
pnpm --filter @creem_io/webhook-types typecheck
pnpm --filter @creem_io/webhook-types test
```

## License

[MIT](./LICENSE)
