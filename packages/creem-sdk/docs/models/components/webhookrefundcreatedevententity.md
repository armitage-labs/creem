# WebhookRefundCreatedEventEntity

## Example Usage

```typescript
import { WebhookRefundCreatedEventEntity } from "creem/models/components";

let value: WebhookRefundCreatedEventEntity = {
  id: "<id>",
  eventType: "refund.created",
  createdAt: 9334.89,
  object: {
    id: "<id>",
    mode: "sandbox",
    object: "<value>",
    status: "succeeded",
    refundAmount: 1000,
    refundCurrency: "USD",
    reason: "duplicate",
    transaction: {
      id: "<id>",
      mode: "sandbox",
      object: "transaction",
      amount: 2000,
      amountPaid: 2000,
      discountAmount: 2000,
      currency: "USD",
      type: "invoice",
      taxCountry: "US",
      taxAmount: 2000,
      status: "paid",
      refundedAmount: 2000,
      createdAt: 5037.76,
    },
    checkout: "<value>",
    order: {
      id: "<id>",
      mode: "test",
      object: "<value>",
      product: "Gorgeous Concrete Pizza",
      transaction: "tx_1234567890",
      discount: "dis_1234567890",
      amount: 2000,
      subTotal: 1800,
      taxAmount: 200,
      discountAmount: 100,
      amountDue: 1900,
      amountPaid: 1900,
      currency: "USD",
      fxAmount: 15,
      fxCurrency: "EUR",
      fxRate: 1.2,
      status: "paid",
      type: "recurring",
      createdAt: new Date("2023-09-13T00:00:00Z"),
      updatedAt: new Date("2023-09-13T00:00:00Z"),
    },
    subscription: "<value>",
    customer: {
      id: "<id>",
      mode: "test",
      object: "<value>",
      email: "user@example.com",
      name: "John Doe",
      metadata: {
        "key": "value",
      },
      country: "US",
      createdAt: new Date("2023-01-01T00:00:00Z"),
      updatedAt: new Date("2023-01-01T00:00:00Z"),
    },
    createdAt: 2676.26,
  },
};
```

## Fields

| Field                                                                                                                      | Type                                                                                                                       | Required                                                                                                                   | Description                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                       | *string*                                                                                                                   | :heavy_check_mark:                                                                                                         | Unique identifier for the event.                                                                                           |
| `eventType`                                                                                                                | [components.WebhookRefundCreatedEventEntityEventType](../../models/components/webhookrefundcreatedevententityeventtype.md) | :heavy_check_mark:                                                                                                         | The event name.                                                                                                            |
| `createdAt`                                                                                                                | *number*                                                                                                                   | :heavy_check_mark:                                                                                                         | Creation date of the event.                                                                                                |
| `object`                                                                                                                   | [components.RefundEntity](../../models/components/refundentity.md)                                                         | :heavy_check_mark:                                                                                                         | Object related to the event.                                                                                               |