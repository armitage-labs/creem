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

## Development

From the repository root:

```bash
pnpm --filter @creem_io/webhook-types build
pnpm --filter @creem_io/webhook-types typecheck
pnpm --filter @creem_io/webhook-types test
```

## License

[MIT](./LICENSE)
