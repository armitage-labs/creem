# WebhookCreditsConsumedEventEntity

## Example Usage

```typescript
import { WebhookCreditsConsumedEventEntity } from "creem/models/components";

let value: WebhookCreditsConsumedEventEntity = {
  id: "<id>",
  eventType: "credits.consumed",
  createdAt: 1879.21,
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

| Field                                                                                                                          | Type                                                                                                                           | Required                                                                                                                       | Description                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                           | *string*                                                                                                                       | :heavy_check_mark:                                                                                                             | Unique identifier for the event.                                                                                               |
| `eventType`                                                                                                                    | [components.WebhookCreditsConsumedEventEntityEventType](../../models/components/webhookcreditsconsumedevententityeventtype.md) | :heavy_check_mark:                                                                                                             | The event name.                                                                                                                |
| `createdAt`                                                                                                                    | *number*                                                                                                                       | :heavy_check_mark:                                                                                                             | Timestamp of when the event was created.                                                                                       |
| `object`                                                                                                                       | [components.CustomerCreditsConsumptionEntity](../../models/components/customercreditsconsumptionentity.md)                     | :heavy_check_mark:                                                                                                             | Object related to the event.                                                                                                   |