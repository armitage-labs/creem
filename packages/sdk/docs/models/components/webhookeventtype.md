# WebhookEventType

The event type carried in the delivery.

## Example Usage

```typescript
import { WebhookEventType } from "creem/models/components";

let value: WebhookEventType = "subscription.trialing";
```

## Values

```typescript
"checkout.completed" | "refund.created" | "dispute.created" | "subscription.active" | "subscription.trialing" | "subscription.canceled" | "subscription.scheduled_cancel" | "subscription.paid" | "subscription.expired" | "subscription.unpaid" | "subscription.update" | "subscription.past_due" | "subscription.paused" | "customer_credits.exhausted" | "credits.granted" | "credits.consumed" | "credits.auto_recharged"
```