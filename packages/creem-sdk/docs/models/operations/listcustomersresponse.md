# ListCustomersResponse

## Example Usage

```typescript
import { ListCustomersResponse } from "creem/models/operations";

let value: ListCustomersResponse = {
  result: {
    items: [
      {
        id: "<id>",
        mode: "test",
        object: "<value>",
        email: "user@example.com",
        name: "John Doe",
        metadata: {
          "key": "value",
        },
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
  },
};
```

## Fields

| Field                                                                          | Type                                                                           | Required                                                                       | Description                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `result`                                                                       | [components.CustomerListEntity](../../models/components/customerlistentity.md) | :heavy_check_mark:                                                             | N/A                                                                            |