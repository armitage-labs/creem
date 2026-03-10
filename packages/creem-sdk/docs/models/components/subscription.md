# Subscription

The subscription associated with the checkout session.


## Supported Types

### `string`

```typescript
const value: string = "<value>";
```

### `components.SubscriptionEntity`

```typescript
const value: components.SubscriptionEntity = {
  id: "<id>",
  mode: "prod",
  object: "subscription",
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
        type: "file",
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
  customer: {
    id: "<id>",
    mode: "prod",
    object: "<value>",
    email: "user@example.com",
    name: "John Doe",
    country: "US",
    createdAt: new Date("2023-01-01T00:00:00Z"),
    updatedAt: new Date("2023-01-01T00:00:00Z"),
  },
  collectionMethod: "charge_automatically",
  status: "active",
  lastTransactionId: "tran_3e6Z6TzvHKdsjEgXnGDEp0",
  lastTransaction: {
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
    status: "uncollectible",
    refundedAmount: 2000,
    createdAt: 3801.23,
  },
  lastTransactionDate: new Date("2024-09-12T12:34:56Z"),
  nextTransactionDate: new Date("2024-09-12T12:34:56Z"),
  currentPeriodStartDate: new Date("2024-09-12T12:34:56Z"),
  currentPeriodEndDate: new Date("2024-09-12T12:34:56Z"),
  canceledAt: new Date("2024-09-12T12:34:56Z"),
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-09-12T12:34:56Z"),
};
```

