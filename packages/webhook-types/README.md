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
passes it through as sent, so a `switch` over the known values needs a
`default` branch:

```ts
switch (refund.reason) {
  case "duplicate":
    break;
  default:
  // a reason added after this version
}
```

The fields that identify an event or an object (`eventType`, `object`) stay
closed.

## Development

From the repository root:

```bash
pnpm --filter @creem_io/webhook-types build
pnpm --filter @creem_io/webhook-types typecheck
pnpm --filter @creem_io/webhook-types test
```

## License

[MIT](./LICENSE)
