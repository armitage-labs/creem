# SearchDiscountsRequest

## Example Usage

```typescript
import { SearchDiscountsRequest } from "creem/models/operations";

let value: SearchDiscountsRequest = {
  productId: "prod_1234567890",
  createdAfter: "2024-01-01T00:00:00Z",
  createdBefore: "2024-12-31T23:59:59Z",
};
```

## Fields

| Field                                                  | Type                                                   | Required                                               | Description                                            | Example                                                |
| ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------ |
| `pageNumber`                                           | *number*                                               | :heavy_minus_sign:                                     | The page number for pagination.                        | 1                                                      |
| `pageSize`                                             | *number*                                               | :heavy_minus_sign:                                     | The number of items per page.                          | 10                                                     |
| `productId`                                            | *string*                                               | :heavy_minus_sign:                                     | Filter discounts that apply to a specific product.     | prod_1234567890                                        |
| `status`                                               | [operations.Status](../../models/operations/status.md) | :heavy_minus_sign:                                     | Filter by discount status.                             |                                                        |
| `type`                                                 | [operations.Type](../../models/operations/type.md)     | :heavy_minus_sign:                                     | Filter by discount type.                               |                                                        |
| `createdAfter`                                         | *string*                                               | :heavy_minus_sign:                                     | Filter discounts created after this date.              | 2024-01-01T00:00:00Z                                   |
| `createdBefore`                                        | *string*                                               | :heavy_minus_sign:                                     | Filter discounts created before this date.             | 2024-12-31T23:59:59Z                                   |