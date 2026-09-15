# TransactionListResponseDto

## Example Usage

```typescript
import { TransactionListResponseDto } from "creem/models/components";

let value: TransactionListResponseDto = {
  object: "list",
  data: [],
  hasMore: false,
};
```

## Fields

| Field                                                                                    | Type                                                                                     | Required                                                                                 | Description                                                                              | Example                                                                                  |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `object`                                                                                 | *string*                                                                                 | :heavy_check_mark:                                                                       | Object type                                                                              | list                                                                                     |
| `data`                                                                                   | [components.TransactionResponseDto](../../models/components/transactionresponsedto.md)[] | :heavy_check_mark:                                                                       | Array of transactions                                                                    |                                                                                          |
| `hasMore`                                                                                | *boolean*                                                                                | :heavy_check_mark:                                                                       | Whether more items exist beyond this page                                                |                                                                                          |