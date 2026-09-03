# ListCustomerCreditsAccountsResponse

## Example Usage

```typescript
import { ListCustomerCreditsAccountsResponse } from "creem/models/operations";

let value: ListCustomerCreditsAccountsResponse = {
  result: {
    object: "list",
    data: [
      {
        id: "cca_abc123",
        storeId: "<id>",
        customerId: "cust_abc123",
        name: "default",
        unitLabel: "credits",
        status: "active",
        createdAt: "1707636479329",
        updatedAt: "1735633494218",
      },
    ],
    hasMore: false,
  },
};
```

## Fields

| Field                                                                                  | Type                                                                                   | Required                                                                               | Description                                                                            |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `result`                                                                               | [components.AccountListResponseDto](../../models/components/accountlistresponsedto.md) | :heavy_check_mark:                                                                     | N/A                                                                                    |