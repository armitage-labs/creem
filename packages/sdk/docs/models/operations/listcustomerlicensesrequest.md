# ListCustomerLicensesRequest

## Example Usage

```typescript
import { ListCustomerLicensesRequest } from "creem/models/operations";

let value: ListCustomerLicensesRequest = {
  id: "<id>",
};
```

## Fields

| Field                                 | Type                                  | Required                              | Description                           | Example                               |
| ------------------------------------- | ------------------------------------- | ------------------------------------- | ------------------------------------- | ------------------------------------- |
| `id`                                  | *string*                              | :heavy_check_mark:                    | The unique identifier of the customer |                                       |
| `pageNumber`                          | *number*                              | :heavy_minus_sign:                    | The page number for pagination.       | 1                                     |
| `pageSize`                            | *number*                              | :heavy_minus_sign:                    | The number of items per page.         | 10                                    |