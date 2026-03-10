# CustomerListEntity

## Example Usage

```typescript
import { CustomerListEntity } from "creem/models/components";

let value: CustomerListEntity = {
  items: [
    {
      id: "<id>",
      mode: "test",
      object: "<value>",
      email: "user@example.com",
      name: "John Doe",
      country: "US",
      createdAt: new Date("2023-01-01T00:00:00Z"),
      updatedAt: new Date("2023-01-01T00:00:00Z"),
    },
  ],
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
| `items`                                                                    | [components.CustomerEntity](../../models/components/customerentity.md)[]   | :heavy_check_mark:                                                         | List of customer items                                                     |
| `pagination`                                                               | [components.PaginationEntity](../../models/components/paginationentity.md) | :heavy_check_mark:                                                         | Pagination details for the list                                            |