# ListLicenseInstancesRequest

## Example Usage

```typescript
import { ListLicenseInstancesRequest } from "creem/models/operations";

let value: ListLicenseInstancesRequest = {
  id: "<id>",
};
```

## Fields

| Field                                    | Type                                     | Required                                 | Description                              | Example                                  |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| `id`                                     | *string*                                 | :heavy_check_mark:                       | The unique identifier of the license key |                                          |
| `pageNumber`                             | *number*                                 | :heavy_minus_sign:                       | The page number for pagination.          | 1                                        |
| `pageSize`                               | *number*                                 | :heavy_minus_sign:                       | The number of items per page.            | 10                                       |