# ListCustomerCreditsAccountsRequest

## Example Usage

```typescript
import { ListCustomerCreditsAccountsRequest } from "creem/models/operations";

let value: ListCustomerCreditsAccountsRequest = {
  customerId: "cust_abc123",
};
```

## Fields

| Field                                                     | Type                                                      | Required                                                  | Description                                               | Example                                                   |
| --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `limit`                                                   | *number*                                                  | :heavy_minus_sign:                                        | Maximum number of accounts to return                      |                                                           |
| `customerId`                                              | *string*                                                  | :heavy_minus_sign:                                        | Filter by owner ID (e.g. customer ID)                     | cust_abc123                                               |
| `startingAfter`                                           | *string*                                                  | :heavy_minus_sign:                                        | Cursor for forward pagination — account ID to start after |                                                           |
| `endingBefore`                                            | *string*                                                  | :heavy_minus_sign:                                        | Cursor for backward pagination — account ID to end before |                                                           |