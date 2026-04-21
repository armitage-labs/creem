# ListCustomerCreditsAccountEntriesRequest

## Example Usage

```typescript
import { ListCustomerCreditsAccountEntriesRequest } from "creem/models/operations";

let value: ListCustomerCreditsAccountEntriesRequest = {
  id: "<id>",
};
```

## Fields

| Field                                                   | Type                                                    | Required                                                | Description                                             |
| ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| `id`                                                    | *string*                                                | :heavy_check_mark:                                      | N/A                                                     |
| `limit`                                                 | *number*                                                | :heavy_minus_sign:                                      | Maximum number of entries to return                     |
| `startingAfter`                                         | *string*                                                | :heavy_minus_sign:                                      | Cursor for forward pagination — entry ID to start after |
| `endingBefore`                                          | *string*                                                | :heavy_minus_sign:                                      | Cursor for backward pagination — entry ID to end before |