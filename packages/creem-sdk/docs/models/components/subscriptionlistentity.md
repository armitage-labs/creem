# SubscriptionListEntity

## Example Usage

```typescript
import { SubscriptionListEntity } from "creem/models/components";

let value: SubscriptionListEntity = {
  items: [
    {
      id: "<id>",
      mode: "sandbox",
      object: "subscription",
      product: "Small Metal Pizza",
      customer: {
        id: "<id>",
        mode: "test",
        object: "<value>",
        email: "user@example.com",
        name: "John Doe",
        metadata: {},
        country: "US",
        createdAt: new Date("2023-01-01T00:00:00Z"),
        updatedAt: new Date("2023-01-01T00:00:00Z"),
      },
      collectionMethod: "charge_automatically",
      status: "unpaid",
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
        status: "uncollectible",
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
    },
  ],
  pagination: {
    totalRecords: 0,
    totalPages: 0,
    currentPage: 1,
    nextPage: 2,
    prevPage: null,
  },
};
```

## Fields

| Field                                                                            | Type                                                                             | Required                                                                         | Description                                                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `items`                                                                          | [components.SubscriptionEntity](../../models/components/subscriptionentity.md)[] | :heavy_check_mark:                                                               | List of subscription items                                                       |
| `pagination`                                                                     | [components.PaginationEntity](../../models/components/paginationentity.md)       | :heavy_check_mark:                                                               | Pagination details for the list                                                  |