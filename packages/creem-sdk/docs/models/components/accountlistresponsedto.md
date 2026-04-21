# AccountListResponseDto

## Example Usage

```typescript
import { AccountListResponseDto } from "creem/models/components";

let value: AccountListResponseDto = {
  object: "list",
  data: [],
  hasMore: false,
};
```

## Fields

| Field                                                                            | Type                                                                             | Required                                                                         | Description                                                                      | Example                                                                          |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `object`                                                                         | *string*                                                                         | :heavy_check_mark:                                                               | Object type                                                                      | list                                                                             |
| `data`                                                                           | [components.AccountResponseDto](../../models/components/accountresponsedto.md)[] | :heavy_check_mark:                                                               | Array of accounts                                                                |                                                                                  |
| `hasMore`                                                                        | *boolean*                                                                        | :heavy_check_mark:                                                               | Whether more items exist beyond this page                                        |                                                                                  |