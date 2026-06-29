# WebhookCheckoutCompletedEventEntity

## Example Usage

```typescript
import { WebhookCheckoutCompletedEventEntity } from "creem/models/components";

let value: WebhookCheckoutCompletedEventEntity = {
  id: "<id>",
  eventType: "checkout.completed",
  createdAt: 7836.78,
  object: {
    id: "<id>",
    mode: "sandbox",
    object: "<value>",
    status: "completed",
    product: {
      id: "<id>",
      mode: "sandbox",
      object: "<value>",
      name: "<value>",
      description: "This is a sample product description.",
      imageUrl: "https://example.com/image.jpg",
      features: [
        {
          id: "feat_abc123",
          type: "licenseKey",
          description: "Access to premium course materials.",
        },
      ],
      price: 400,
      currency: "USD",
      billingType: "onetime",
      billingPeriod: "every-three-months",
      status: "archived",
      taxMode: "exclusive",
      taxCategory: "saas",
      productUrl: "https://creem.io/product/prod_123123123123",
      defaultSuccessUrl: "https://example.com/?status=successful",
      createdAt: new Date("2023-01-01T00:00:00Z"),
      updatedAt: new Date("2023-01-01T00:00:00Z"),
    },
    customPrice: 1500,
    order: {
      id: "<id>",
      mode: "prod",
      object: "<value>",
      product: "Elegant Rubber Car",
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
    subscription: {
      id: "<id>",
      mode: "sandbox",
      object: "subscription",
      product: "Modern Bronze Towels",
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
      collectionMethod: "charge_automatically",
      status: "active",
      lastTransactionId: "tran_3e6Z6TzvHKdsjEgXnGDEp0",
      lastTransaction: {
        id: "<id>",
        mode: "prod",
        object: "transaction",
        amount: 2000,
        amountPaid: 2000,
        discountAmount: 2000,
        currency: "USD",
        type: "payment",
        taxCountry: "US",
        taxAmount: 2000,
        status: "declined",
        refundedAmount: 2000,
        createdAt: 298.46,
      },
      lastTransactionDate: new Date("2024-09-12T12:34:56Z"),
      nextTransactionDate: new Date("2024-09-12T12:34:56Z"),
      currentPeriodStartDate: new Date("2024-09-12T12:34:56Z"),
      currentPeriodEndDate: new Date("2024-09-12T12:34:56Z"),
      canceledAt: new Date("2024-09-12T12:34:56Z"),
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-09-12T12:34:56Z"),
      discount: {
        id: "dis_3e6Z6TzvHKdsjEgXnGDEp0",
        discountCode: "HOLIDAY2024",
      },
      metadata: {
        "userId": "user_123",
        "plan": "pro",
      },
    },
    customer: "<value>",
    successUrl: "https://example.com/return",
    licenseKeys: [
      {
        id: "<id>",
        mode: "prod",
        object: "<value>",
        productId: "prod_abc123",
        status: "expired",
        key: "ABC123-XYZ456-XYZ456-XYZ456",
        activation: 5,
        activationLimit: 1,
        expiresAt: new Date("2023-09-13T00:00:00Z"),
        createdAt: new Date("2023-09-13T00:00:00Z"),
        instance: {
          id: "<id>",
          mode: "prod",
          object: "license-instance",
          name: "My Customer License Instance",
          status: "active",
          createdAt: new Date("2023-09-13T00:00:00Z"),
        },
      },
    ],
    metadata: {
      "userId": "user_123",
      "visitCount": 42,
      "lastVisit": "2023-04-01",
    },
    discount: {
      id: "dis_3e6Z6TzvHKdsjEgXnGDEp0",
      discountCode: "HOLIDAY2024",
    },
  },
};
```

## Fields

| Field                                                                  | Type                                                                   | Required                                                               | Description                                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `id`                                                                   | *string*                                                               | :heavy_check_mark:                                                     | Unique identifier for the event.                                       |
| `eventType`                                                            | [components.EventType](../../models/components/eventtype.md)           | :heavy_check_mark:                                                     | The event name.                                                        |
| `createdAt`                                                            | *number*                                                               | :heavy_check_mark:                                                     | Creation date of the event.                                            |
| `object`                                                               | [components.CheckoutEntity](../../models/components/checkoutentity.md) | :heavy_check_mark:                                                     | Object related to the event.                                           |