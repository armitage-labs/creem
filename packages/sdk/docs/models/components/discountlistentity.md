# DiscountListEntity

## Example Usage

```typescript
import { DiscountListEntity } from "creem/models/components";

let value: DiscountListEntity = {
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
| `items`                                                                    | [components.DiscountEntity](../../models/components/discountentity.md)[]   | :heavy_check_mark:                                                         | List of discount items                                                     |
| `pagination`                                                               | [components.PaginationEntity](../../models/components/paginationentity.md) | :heavy_check_mark:                                                         | Pagination details for the list                                            |