# WebhookEventEntityWebhookCreditsGrantedEventEntity

## Example Usage

```typescript
import { WebhookEventEntityWebhookCreditsGrantedEventEntity } from "creem/models/components";

let value: WebhookEventEntityWebhookCreditsGrantedEventEntity = {
  id: "<id>",
  eventType: "credits.granted",
  createdAt: 3650.95,
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
    object: "customer_credits_grant",
  },
};
```

## Fields

| Field                                                                                                                                                            | Type                                                                                                                                                             | Required                                                                                                                                                         | Description                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                                                             | *string*                                                                                                                                                         | :heavy_check_mark:                                                                                                                                               | Unique identifier for the event.                                                                                                                                 |
| `eventType`                                                                                                                                                      | [components.WebhookCreditsGrantedEventEntityWebhookEventEntityEventType](../../models/components/webhookcreditsgrantedevententitywebhookevententityeventtype.md) | :heavy_check_mark:                                                                                                                                               | The event name.                                                                                                                                                  |
| `createdAt`                                                                                                                                                      | *number*                                                                                                                                                         | :heavy_check_mark:                                                                                                                                               | Timestamp of when the event was created.                                                                                                                         |
| `object`                                                                                                                                                         | [components.CustomerCreditsGrantEntity](../../models/components/customercreditsgrantentity.md)                                                                   | :heavy_check_mark:                                                                                                                                               | Object related to the event.                                                                                                                                     |