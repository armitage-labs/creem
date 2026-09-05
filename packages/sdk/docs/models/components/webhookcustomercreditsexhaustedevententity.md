# WebhookCustomerCreditsExhaustedEventEntity

## Example Usage

```typescript
import { WebhookCustomerCreditsExhaustedEventEntity } from "creem/models/components";

let value: WebhookCustomerCreditsExhaustedEventEntity = {
  id: "<id>",
  eventType: "customer_credits.exhausted",
  createdAt: 1064.23,
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

| Field                                                                                                                                            | Type                                                                                                                                             | Required                                                                                                                                         | Description                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                             | *string*                                                                                                                                         | :heavy_check_mark:                                                                                                                               | Unique identifier for the event.                                                                                                                 |
| `eventType`                                                                                                                                      | [components.WebhookCustomerCreditsExhaustedEventEntityEventType](../../models/components/webhookcustomercreditsexhaustedevententityeventtype.md) | :heavy_check_mark:                                                                                                                               | The event name.                                                                                                                                  |
| `createdAt`                                                                                                                                      | *number*                                                                                                                                         | :heavy_check_mark:                                                                                                                               | Timestamp of when the event was created.                                                                                                         |
| `object`                                                                                                                                         | [components.CustomerCreditsExhaustionEntity](../../models/components/customercreditsexhaustionentity.md)                                         | :heavy_check_mark:                                                                                                                               | Object related to the event.                                                                                                                     |