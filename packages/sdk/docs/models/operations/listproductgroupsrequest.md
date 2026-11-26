# ListProductGroupsRequest

## Example Usage

```typescript
import { ListProductGroupsRequest } from "creem/models/operations";

let value: ListProductGroupsRequest = {
  externalId: "plans",
};
```

## Fields

| Field                                                                                       | Type                                                                                        | Required                                                                                    | Description                                                                                 | Example                                                                                     |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `limit`                                                                                     | *number*                                                                                    | :heavy_minus_sign:                                                                          | Maximum number of product groups to return                                                  |                                                                                             |
| `startingAfter`                                                                             | *string*                                                                                    | :heavy_minus_sign:                                                                          | Cursor for forward pagination: the product group ID to start after                          |                                                                                             |
| `endingBefore`                                                                              | *string*                                                                                    | :heavy_minus_sign:                                                                          | Cursor for backward pagination: the product group ID to end before                          |                                                                                             |
| `externalId`                                                                                | *string*                                                                                    | :heavy_minus_sign:                                                                          | Only the product group with this `external_id` (your own key). Case-sensitive, exact match. | plans                                                                                       |