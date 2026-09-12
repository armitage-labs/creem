# WebhookCreditsGrantedEventEntity

## Example Usage

```typescript
import { WebhookCreditsGrantedEventEntity } from "creem/models/components";

let value: WebhookCreditsGrantedEventEntity = {
  id: "<id>",
  eventType: "credits.granted",
  createdAt: 1717.47,
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

| Field                                                                                                                        | Type                                                                                                                         | Required                                                                                                                     | Description                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                         | *string*                                                                                                                     | :heavy_check_mark:                                                                                                           | Unique identifier for the event.                                                                                             |
| `eventType`                                                                                                                  | [components.WebhookCreditsGrantedEventEntityEventType](../../models/components/webhookcreditsgrantedevententityeventtype.md) | :heavy_check_mark:                                                                                                           | The event name.                                                                                                              |
| `createdAt`                                                                                                                  | *number*                                                                                                                     | :heavy_check_mark:                                                                                                           | Timestamp of when the event was created.                                                                                     |
| `object`                                                                                                                     | [components.CustomerCreditsGrantEntity](../../models/components/customercreditsgrantentity.md)                               | :heavy_check_mark:                                                                                                           | Object related to the event.                                                                                                 |