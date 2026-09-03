# SearchTransactionsRequest

## Example Usage

```typescript
import { SearchTransactionsRequest } from "creem/models/operations";

let value: SearchTransactionsRequest = {
  customerId: "cust_1234567890",
  orderId: "ord_1234567890",
  productId: "prod_1234567890",
};
```

## Fields

| Field                               | Type                                | Required                            | Description                         | Example                             |
| ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- |
| `customerId`                        | *string*                            | :heavy_minus_sign:                  | Filter transactions by customer ID. | cust_1234567890                     |
| `orderId`                           | *string*                            | :heavy_minus_sign:                  | Filter transactions by order ID.    | ord_1234567890                      |
| `productId`                         | *string*                            | :heavy_minus_sign:                  | Filter transactions by product ID.  | prod_1234567890                     |
| `pageNumber`                        | *number*                            | :heavy_minus_sign:                  | The page number for pagination.     | 1                                   |
| `pageSize`                          | *number*                            | :heavy_minus_sign:                  | The number of items per page.       | 10                                  |