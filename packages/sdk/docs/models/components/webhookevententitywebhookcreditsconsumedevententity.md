# WebhookEventEntityWebhookCreditsConsumedEventEntity

## Example Usage

```typescript
import { WebhookEventEntityWebhookCreditsConsumedEventEntity } from "creem/models/components";

let value: WebhookEventEntityWebhookCreditsConsumedEventEntity = {
  id: "<id>",
  eventType: "credits.consumed",
  createdAt: 4548.37,
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
    object: "customer_credits_consumption",
  },
};
```

## Fields

| Field                                                                                                                                                              | Type                                                                                                                                                               | Required                                                                                                                                                           | Description                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                               | *string*                                                                                                                                                           | :heavy_check_mark:                                                                                                                                                 | Unique identifier for the event.                                                                                                                                   |
| `eventType`                                                                                                                                                        | [components.WebhookCreditsConsumedEventEntityWebhookEventEntityEventType](../../models/components/webhookcreditsconsumedevententitywebhookevententityeventtype.md) | :heavy_check_mark:                                                                                                                                                 | The event name.                                                                                                                                                    |
| `createdAt`                                                                                                                                                        | *number*                                                                                                                                                           | :heavy_check_mark:                                                                                                                                                 | Timestamp of when the event was created.                                                                                                                           |
| `object`                                                                                                                                                           | [components.CustomerCreditsConsumptionEntity](../../models/components/customercreditsconsumptionentity.md)                                                         | :heavy_check_mark:                                                                                                                                                 | Object related to the event.                                                                                                                                       |