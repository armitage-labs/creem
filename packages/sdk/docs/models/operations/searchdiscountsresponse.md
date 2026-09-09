# SearchDiscountsResponse

## Example Usage

```typescript
import { SearchDiscountsResponse } from "creem/models/operations";

let value: SearchDiscountsResponse = {
  result: {
    items: [
      {
        id: "<id>",
        mode: "test",
        object: "discount",
        status: "active",
        name: "Holiday Sale",
        code: "HOLIDAY2024",
        type: "percentage",
        amount: 20,
        currency: "USD",
        percentage: 15,
        expiryDate: new Date("2024-12-31T23:59:59Z"),
        maxRedemptions: 100,
        duration: "repeating",
        durationInMonths: 6,
        appliesToProducts: [
          "prod_123",
          "prod_456",
        ],
        redeemCount: 15,
      },
    ],
    pagination: {
      totalRecords: 0,
      totalPages: 0,
      currentPage: 1,
      nextPage: 2,
      prevPage: null,
    },
  },
};
```

## Fields

| Field                                                                          | Type                                                                           | Required                                                                       | Description                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `result`                                                                       | [components.DiscountListEntity](../../models/components/discountlistentity.md) | :heavy_check_mark:                                                             | N/A                                                                            |