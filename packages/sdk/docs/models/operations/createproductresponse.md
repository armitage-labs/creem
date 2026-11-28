# CreateProductResponse

## Example Usage

```typescript
import { CreateProductResponse } from "creem/models/operations";

let value: CreateProductResponse = {
  headers: {},
  result: {
    id: "<id>",
    mode: "prod",
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
        type: "githubRepository",
        description: "Access to premium course materials.",
        externalId: "pro-credits",
        customerCredits: {
          amount: "100",
          unitLabel: "tokens",
          bucketName: "images",
          requiresModeration: false,
          resetsEachPeriod: false,
        },
        licenseKey: {
          activationLimit: 3,
          expiry: {
            interval: "month",
            intervalCount: 1,
          },
        },
        privateNote: "Thanks for your purchase! Your access code is XYZ123.",
        file: {
          files: [],
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
        settlementMode: "prepaid",
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
    suggestedPrice: 2500,
    status: "archived",
    taxMode: "exclusive",
    businessNetPricing: false,
    taxCategory: "ebooks",
    productUrl: "https://creem.io/product/prod_123123123123",
    defaultSuccessUrl: "https://example.com/?status=successful",
    externalId: "pro-monthly",
    metadata: {
      "plan": "pro",
    },
    createdAt: new Date("2023-01-01T00:00:00Z"),
    updatedAt: new Date("2023-01-01T00:00:00Z"),
    writeResult: {
      result: "updated",
      dryRun: false,
      changes: [],
      warnings: [
        {
          code: "usage_prices_shared",
          path: "currency",
          impact: {
            total: 12,
            byStatus: {
              "active": 9,
              "trialing": 1,
              "past_due": 1,
              "scheduled_cancel": 0,
              "paused": 1,
              "unpaid": 0,
            },
            unsettledPostpaidUsage: 0,
            autoRechargeConsents: 3,
          },
        },
      ],
      priceVersion: {
        created: true,
        previousPriceId: "pprice_old",
        newPriceId: "pprice_new",
        subscriptionsOnOlderPrices: {
          total: 12,
          byStatus: {
            "active": 9,
            "trialing": 1,
            "past_due": 1,
            "scheduled_cancel": 0,
            "paused": 1,
            "unpaid": 0,
          },
        },
      },
    },
  },
};
```

## Fields

| Field                                                                                          | Type                                                                                           | Required                                                                                       | Description                                                                                    |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `headers`                                                                                      | Record<string, *string*[]>                                                                     | :heavy_check_mark:                                                                             | N/A                                                                                            |
| `result`                                                                                       | [components.ProductWriteResponseEntity](../../models/components/productwriteresponseentity.md) | :heavy_check_mark:                                                                             | N/A                                                                                            |