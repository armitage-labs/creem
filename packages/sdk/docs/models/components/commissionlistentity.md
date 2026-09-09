# CommissionListEntity

## Example Usage

```typescript
import { CommissionListEntity } from "creem/models/components";

let value: CommissionListEntity = {
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

| Field                                                                        | Type                                                                         | Required                                                                     | Description                                                                  |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `items`                                                                      | [components.CommissionEntity](../../models/components/commissionentity.md)[] | :heavy_check_mark:                                                           | List of commission items                                                     |
| `pagination`                                                                 | [components.PaginationEntity](../../models/components/paginationentity.md)   | :heavy_check_mark:                                                           | Pagination details for the list                                              |