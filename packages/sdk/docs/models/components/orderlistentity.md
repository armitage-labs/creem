# OrderListEntity

## Example Usage

```typescript
import { OrderListEntity } from "creem/models/components";

let value: OrderListEntity = {
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
| `items`                                                                    | [components.OrderEntity](../../models/components/orderentity.md)[]         | :heavy_check_mark:                                                         | List of order items                                                        |
| `pagination`                                                               | [components.PaginationEntity](../../models/components/paginationentity.md) | :heavy_check_mark:                                                         | Pagination details for the list                                            |