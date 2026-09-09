# ListLicenseInstancesResponse

## Example Usage

```typescript
import { ListLicenseInstancesResponse } from "creem/models/operations";

let value: ListLicenseInstancesResponse = {
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

| Field                                                                                        | Type                                                                                         | Required                                                                                     | Description                                                                                  |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `result`                                                                                     | [components.LicenseInstanceListEntity](../../models/components/licenseinstancelistentity.md) | :heavy_check_mark:                                                                           | N/A                                                                                          |