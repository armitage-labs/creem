# WebhookEventEntityWebhookCreditsReversedEventEntity

## Example Usage

```typescript
import { WebhookEventEntityWebhookCreditsReversedEventEntity } from "creem/models/components";

let value: WebhookEventEntityWebhookCreditsReversedEventEntity = {
  id: "<id>",
  eventType: "credits.reversed",
  createdAt: 859.78,
  object: {
    id: "<id>",
    customerId: "<id>",
    accountId: "<id>",
    bucketName: "<value>",
    unitLabel: "<value>",
    amountMinorUnits: "<value>",
    balanceAfterMinorUnits: "<value>",
    reference: "<value>",
    occurredAt: "<value>",
    object: "customer_credits_reversal",
    side: "credit",
    reversedTransactionId: "<id>",
  },
};
```

## Fields

| Field                                                                                                                                                              | Type                                                                                                                                                               | Required                                                                                                                                                           | Description                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                               | *string*                                                                                                                                                           | :heavy_check_mark:                                                                                                                                                 | Unique identifier for the event.                                                                                                                                   |
| `eventType`                                                                                                                                                        | [components.WebhookCreditsReversedEventEntityWebhookEventEntityEventType](../../models/components/webhookcreditsreversedevententitywebhookevententityeventtype.md) | :heavy_check_mark:                                                                                                                                                 | The event name.                                                                                                                                                    |
| `createdAt`                                                                                                                                                        | *number*                                                                                                                                                           | :heavy_check_mark:                                                                                                                                                 | Timestamp of when the event was created.                                                                                                                           |
| `object`                                                                                                                                                           | [components.CustomerCreditsReversalEntity](../../models/components/customercreditsreversalentity.md)                                                               | :heavy_check_mark:                                                                                                                                                 | Object related to the event.                                                                                                                                       |