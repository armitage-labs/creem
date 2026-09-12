# WebhookCreditsAutoRechargedEventEntity

## Example Usage

```typescript
import { WebhookCreditsAutoRechargedEventEntity } from "creem/models/components";

let value: WebhookCreditsAutoRechargedEventEntity = {
  id: "<id>",
  eventType: "credits.auto_recharged",
  createdAt: 8206.26,
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

| Field                                                                                                                                    | Type                                                                                                                                     | Required                                                                                                                                 | Description                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                                     | *string*                                                                                                                                 | :heavy_check_mark:                                                                                                                       | Unique identifier for the event.                                                                                                         |
| `eventType`                                                                                                                              | [components.WebhookCreditsAutoRechargedEventEntityEventType](../../models/components/webhookcreditsautorechargedevententityeventtype.md) | :heavy_check_mark:                                                                                                                       | The event name.                                                                                                                          |
| `createdAt`                                                                                                                              | *number*                                                                                                                                 | :heavy_check_mark:                                                                                                                       | Timestamp of when the event was created.                                                                                                 |
| `object`                                                                                                                                 | [components.CustomerCreditsAutoRechargeEntity](../../models/components/customercreditsautorechargeentity.md)                             | :heavy_check_mark:                                                                                                                       | Object related to the event.                                                                                                             |