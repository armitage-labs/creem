# WebhookEventEntityWebhookCreditsAutoRechargedEventEntity

## Example Usage

```typescript
import { WebhookEventEntityWebhookCreditsAutoRechargedEventEntity } from "creem/models/components";

let value: WebhookEventEntityWebhookCreditsAutoRechargedEventEntity = {
  id: "<id>",
  eventType: "credits.auto_recharged",
  createdAt: 1434.42,
  object: {
    id: "<id>",
    object: "customer_credits_auto_recharge",
    customerId: "<id>",
    bucketName: "<value>",
    unitLabel: "<value>",
    amountMinorUnits: "<value>",
    currency: "Tenge",
    chargeReference: "<value>",
    reference: "<value>",
  },
};
```

## Fields

| Field                                                                                                                                                                        | Type                                                                                                                                                                         | Required                                                                                                                                                                     | Description                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                                                                         | *string*                                                                                                                                                                     | :heavy_check_mark:                                                                                                                                                           | Unique identifier for the event.                                                                                                                                             |
| `eventType`                                                                                                                                                                  | [components.WebhookCreditsAutoRechargedEventEntityWebhookEventEntityEventType](../../models/components/webhookcreditsautorechargedevententitywebhookevententityeventtype.md) | :heavy_check_mark:                                                                                                                                                           | The event name.                                                                                                                                                              |
| `createdAt`                                                                                                                                                                  | *number*                                                                                                                                                                     | :heavy_check_mark:                                                                                                                                                           | Timestamp of when the event was created.                                                                                                                                     |
| `object`                                                                                                                                                                     | [components.CustomerCreditsAutoRechargeEntity](../../models/components/customercreditsautorechargeentity.md)                                                                 | :heavy_check_mark:                                                                                                                                                           | Object related to the event.                                                                                                                                                 |