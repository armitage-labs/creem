# ListCustomerCreditsAccountEntriesResponse

## Example Usage

```typescript
import { ListCustomerCreditsAccountEntriesResponse } from "creem/models/operations";

let value: ListCustomerCreditsAccountEntriesResponse = {
  result: {
    object: "list",
    data: [
      {
        id: "cce_abc123",
        transactionId: "cct_abc123",
        accountId: "cca_abc123",
        side: "debit",
        amount: "1000",
        createdAt: "1708527757083",
      },
    ],
    hasMore: false,
  },
};
```

## Fields

| Field                                                                              | Type                                                                               | Required                                                                           | Description                                                                        |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `result`                                                                           | [components.EntryListResponseDto](../../models/components/entrylistresponsedto.md) | :heavy_check_mark:                                                                 | N/A                                                                                |