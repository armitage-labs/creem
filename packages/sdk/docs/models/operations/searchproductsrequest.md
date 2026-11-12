# SearchProductsRequest

## Example Usage

```typescript
import { SearchProductsRequest } from "creem/models/operations";

let value: SearchProductsRequest = {
  externalId: "pro-monthly",
};
```

## Fields

| Field                                                                                 | Type                                                                                  | Required                                                                              | Description                                                                           | Example                                                                               |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `pageNumber`                                                                          | *number*                                                                              | :heavy_minus_sign:                                                                    | The page number for pagination.                                                       | 1                                                                                     |
| `pageSize`                                                                            | *number*                                                                              | :heavy_minus_sign:                                                                    | The number of items per page.                                                         | 10                                                                                    |
| `status`                                                                              | [components.ProductStatus](../../models/components/productstatus.md)                  | :heavy_minus_sign:                                                                    | Lifecycle status of the product: `active` or `archived`.                              |                                                                                       |
| `externalId`                                                                          | *string*                                                                              | :heavy_minus_sign:                                                                    | Only the product with this `external_id` (your own key). Case-sensitive, exact match. | pro-monthly                                                                           |