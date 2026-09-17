# WebhookDeliveryMode

How events reach this endpoint: `http` deliveries are POSTed to `url`; `cli` deliveries wait in the pending-events feed for a local `creem listen` session.

## Example Usage

```typescript
import { WebhookDeliveryMode } from "creem/models/components";

let value: WebhookDeliveryMode = "cli";
```

## Values

```typescript
"http" | "cli"
```