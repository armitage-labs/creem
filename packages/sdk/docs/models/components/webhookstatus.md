# WebhookStatus

Whether the endpoint receives deliveries. Disabled endpoints keep their configuration but receive nothing.

## Example Usage

```typescript
import { WebhookStatus } from "creem/models/components";

let value: WebhookStatus = "enabled";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"enabled" | "disabled" | Unrecognized<string>
```