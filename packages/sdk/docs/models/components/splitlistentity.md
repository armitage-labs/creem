# SplitListEntity

## Example Usage

```typescript
import { SplitListEntity } from "creem/models/components";

let value: SplitListEntity = {
  items: [],
  pagination: {
    totalRecords: 0,
    totalPages: 0,
    currentPage: 1,
    nextPage: 2,
    prevPage: null,
  },
};
```

## Fields

| Field                                                                      | Type                                                                       | Required                                                                   | Description                                                                |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `items`                                                                    | [components.SplitEntity](../../models/components/splitentity.md)[]         | :heavy_check_mark:                                                         | List of split items                                                        |
| `pagination`                                                               | [components.PaginationEntity](../../models/components/paginationentity.md) | :heavy_check_mark:                                                         | Pagination details for the list                                            |