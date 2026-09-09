# ListSplitsResponse

## Example Usage

```typescript
import { ListSplitsResponse } from "creem/models/operations";

let value: ListSplitsResponse = {
  result: {
    items: [],
    pagination: {
      totalRecords: 0,
      totalPages: 0,
      currentPage: 1,
      nextPage: 2,
      prevPage: null,
    },
  },
};
```

## Fields

| Field                                                                    | Type                                                                     | Required                                                                 | Description                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `result`                                                                 | [components.SplitListEntity](../../models/components/splitlistentity.md) | :heavy_check_mark:                                                       | N/A                                                                      |