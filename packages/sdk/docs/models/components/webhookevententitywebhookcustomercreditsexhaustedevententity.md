# WebhookEventEntityWebhookCustomerCreditsExhaustedEventEntity

## Example Usage

```typescript
import { WebhookEventEntityWebhookCustomerCreditsExhaustedEventEntity } from "creem/models/components";

let value: WebhookEventEntityWebhookCustomerCreditsExhaustedEventEntity = {
  id: "<id>",
  eventType: "customer_credits.exhausted",
  createdAt: 5735.29,
  object: {
    id: "<id>",
    object: "customer_credits_exhaustion",
    customerId: "<id>",
    bucketName: "<value>",
    unitLabel: "<value>",
    shortfallMinorUnits: "<value>",
    occurredAt: "<value>",
  },
};
```

## Fields

| Field                                                                                                                                                                                | Type                                                                                                                                                                                 | Required                                                                                                                                                                             | Description                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                                                 | *string*                                                                                                                                                                             | :heavy_check_mark:                                                                                                                                                                   | Unique identifier for the event.                                                                                                                                                     |
| `eventType`                                                                                                                                                                          | [components.WebhookCustomerCreditsExhaustedEventEntityWebhookEventEntityEventType](../../models/components/webhookcustomercreditsexhaustedevententitywebhookevententityeventtype.md) | :heavy_check_mark:                                                                                                                                                                   | The event name.                                                                                                                                                                      |
| `createdAt`                                                                                                                                                                          | *number*                                                                                                                                                                             | :heavy_check_mark:                                                                                                                                                                   | Timestamp of when the event was created.                                                                                                                                             |
| `object`                                                                                                                                                                             | [components.CustomerCreditsExhaustionEntity](../../models/components/customercreditsexhaustionentity.md)                                                                             | :heavy_check_mark:                                                                                                                                                                   | Object related to the event.                                                                                                                                                         |