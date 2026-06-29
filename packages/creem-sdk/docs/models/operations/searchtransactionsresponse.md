# SearchTransactionsResponse

## Example Usage

```typescript
import { SearchTransactionsResponse } from "creem/models/operations";

let value: SearchTransactionsResponse = {
  result: {
    items: [
      {
        id: "<id>",
        mode: "test",
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
        createdAt: 2926.3,
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

| Field                                                                                | Type                                                                                 | Required                                                                             | Description                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `result`                                                                             | [components.TransactionListEntity](../../models/components/transactionlistentity.md) | :heavy_check_mark:                                                                   | N/A                                                                                  |