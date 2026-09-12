# ListMetersRequest

## Example Usage

```typescript
import { ListMetersRequest } from "creem/models/operations";

let value: ListMetersRequest = {
  startingAfter: "mtr_abc123",
  endingBefore: "mtr_abc123",
};
```

## Fields

| Field                                                                                | Type                                                                                 | Required                                                                             | Description                                                                          | Example                                                                              |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `limit`                                                                              | *number*                                                                             | :heavy_minus_sign:                                                                   | Maximum number of meters to return                                                   |                                                                                      |
| `startingAfter`                                                                      | *string*                                                                             | :heavy_minus_sign:                                                                   | Cursor for forward pagination — meter ID to start after                              | mtr_abc123                                                                           |
| `endingBefore`                                                                       | *string*                                                                             | :heavy_minus_sign:                                                                   | Cursor for backward pagination — meter ID to end before                              | mtr_abc123                                                                           |
| `includeArchived`                                                                    | *boolean*                                                                            | :heavy_minus_sign:                                                                   | Include archived meters in the page. Defaults to false — archived meters are hidden. |                                                                                      |