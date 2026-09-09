# EntryListResponseDto

## Example Usage

```typescript
import { EntryListResponseDto } from "creem/models/components";

let value: EntryListResponseDto = {
  object: "list",
  data: [],
  hasMore: true,
};
```

## Fields

| Field                                                                        | Type                                                                         | Required                                                                     | Description                                                                  | Example                                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `object`                                                                     | *string*                                                                     | :heavy_check_mark:                                                           | Object type                                                                  | list                                                                         |
| `data`                                                                       | [components.EntryResponseDto](../../models/components/entryresponsedto.md)[] | :heavy_check_mark:                                                           | Array of entries                                                             |                                                                              |
| `hasMore`                                                                    | *boolean*                                                                    | :heavy_check_mark:                                                           | Whether more items exist beyond this page                                    |                                                                              |