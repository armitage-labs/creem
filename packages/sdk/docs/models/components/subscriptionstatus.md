# SubscriptionStatus

The current status of the subscription.

## Example Usage

```typescript
import { SubscriptionStatus } from "creem/models/components";

let value: SubscriptionStatus = "scheduled_cancel";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"active" | "canceled" | "unpaid" | "paused" | "trialing" | "scheduled_cancel" | "past_due" | Unrecognized<string>
```