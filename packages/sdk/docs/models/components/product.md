# Product

The product associated with the subscription.


## Supported Types

### `components.ProductEntity`

```typescript
const value: components.ProductEntity = {
  id: "<id>",
  mode: "test",
  object: "<value>",
  name: "<value>",
  description: "This is a sample product description.",
  imageUrl: "https://example.com/image.jpg",
  imageUrls: [
    "https://example.com/image.jpg",
  ],
  features: [
    {
      id: "feat_abc123",
      type: "customerCredits",
      description: "Access to premium course materials.",
      customerCredits: {
        amount: "100",
        unitLabel: "tokens",
        bucketName: "images",
      },
    },
  ],
  usagePrices: [
    {
      id: "price_abc123",
      meterId: "mtr_abc123",
      unitPrice: 0.002,
      freeAllowance: 1000,
      cap: 50000,
      settlementMode: "postpaid",
      targetAccount: "per_unit",
      targetAccountName: "images",
      trialUsageMode: "free",
    },
  ],
  price: 400,
  currency: "USD",
  billingType: "onetime",
  billingPeriod: "once",
  recurringInterval: "month",
  recurringIntervalCount: 3,
  trialPeriodDays: 7,
  trialPrice: 100,
  status: "active",
  taxMode: "exclusive",
  businessNetPricing: false,
  taxCategory: "digital-goods-service",
  productUrl: "https://creem.io/product/prod_123123123123",
  defaultSuccessUrl: "https://example.com/?status=successful",
  createdAt: new Date("2023-01-01T00:00:00Z"),
  updatedAt: new Date("2023-01-01T00:00:00Z"),
};
```

### `string`

```typescript
const value: string = "<value>";
```

