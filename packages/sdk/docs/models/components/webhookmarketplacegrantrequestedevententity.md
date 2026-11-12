# WebhookMarketplaceGrantRequestedEventEntity

## Example Usage

```typescript
import { WebhookMarketplaceGrantRequestedEventEntity } from "creem/models/components";

let value: WebhookMarketplaceGrantRequestedEventEntity = {
  id: "<id>",
  eventType: "marketplace.grant.requested",
  createdAt: 2512.28,
  object: {
    grantId: "<id>",
    operationId: "<id>",
    action: "revoke_credit",
    deadlineAt: {},
    reason: null,
    listingId: "<id>",
    productId: "<id>",
    order: {
      id: "<id>",
      status: "<value>",
      amountMinor: 9030.76,
      currency: "Egyptian Pound",
      transactionId: {},
      paidAt: {},
    },
    test: false,
  },
};
```

## Fields

| Field                                                                                                                                              | Type                                                                                                                                               | Required                                                                                                                                           | Description                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                                               | *string*                                                                                                                                           | :heavy_check_mark:                                                                                                                                 | Unique identifier for the event.                                                                                                                   |
| `eventType`                                                                                                                                        | [components.WebhookMarketplaceGrantRequestedEventEntityEventType](../../models/components/webhookmarketplacegrantrequestedevententityeventtype.md) | :heavy_check_mark:                                                                                                                                 | The event name.                                                                                                                                    |
| `createdAt`                                                                                                                                        | *number*                                                                                                                                           | :heavy_check_mark:                                                                                                                                 | Timestamp of when the event was created.                                                                                                           |
| `object`                                                                                                                                           | [components.MarketplaceGrantAskEntity](../../models/components/marketplacegrantaskentity.md)                                                       | :heavy_check_mark:                                                                                                                                 | Object related to the event.                                                                                                                       |