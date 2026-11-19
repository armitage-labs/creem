# WebhookEventEntityWebhookMarketplaceGrantRequestedEventEntity

## Example Usage

```typescript
import { WebhookEventEntityWebhookMarketplaceGrantRequestedEventEntity } from "creem/models/components";

let value: WebhookEventEntityWebhookMarketplaceGrantRequestedEventEntity = {
  id: "<id>",
  eventType: "marketplace.grant.requested",
  createdAt: 9592.97,
  object: {
    grantId: "<id>",
    operationId: "<id>",
    action: "revoke_credit",
    deadlineAt: "<value>",
    reason: null,
    listingId: "<id>",
    productId: "<id>",
    order: {
      id: "<id>",
      status: "<value>",
      amountMinor: 9030.76,
      currency: "Egyptian Pound",
      transactionId: "<id>",
      paidAt: "<value>",
    },
    test: false,
  },
};
```

## Fields

| Field                                                                                                                                                                                  | Type                                                                                                                                                                                   | Required                                                                                                                                                                               | Description                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                                                                                   | *string*                                                                                                                                                                               | :heavy_check_mark:                                                                                                                                                                     | Unique identifier for the event.                                                                                                                                                       |
| `eventType`                                                                                                                                                                            | [components.WebhookMarketplaceGrantRequestedEventEntityWebhookEventEntityEventType](../../models/components/webhookmarketplacegrantrequestedevententitywebhookevententityeventtype.md) | :heavy_check_mark:                                                                                                                                                                     | The event name.                                                                                                                                                                        |
| `createdAt`                                                                                                                                                                            | *number*                                                                                                                                                                               | :heavy_check_mark:                                                                                                                                                                     | Timestamp of when the event was created.                                                                                                                                               |
| `object`                                                                                                                                                                               | [components.MarketplaceGrantAskEntity](../../models/components/marketplacegrantaskentity.md)                                                                                           | :heavy_check_mark:                                                                                                                                                                     | Object related to the event.                                                                                                                                                           |