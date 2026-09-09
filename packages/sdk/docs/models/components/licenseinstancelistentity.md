# LicenseInstanceListEntity

## Example Usage

```typescript
import { LicenseInstanceListEntity } from "creem/models/components";

let value: LicenseInstanceListEntity = {
  items: [
    {
      id: "<id>",
      mode: "prod",
      object: "license-instance",
      name: "My Customer License Instance",
      status: "active",
      createdAt: new Date("2023-09-13T00:00:00Z"),
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

| Field                                                                                  | Type                                                                                   | Required                                                                               | Description                                                                            |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `items`                                                                                | [components.LicenseInstanceEntity](../../models/components/licenseinstanceentity.md)[] | :heavy_check_mark:                                                                     | List of license instance items                                                         |
| `pagination`                                                                           | [components.PaginationEntity](../../models/components/paginationentity.md)             | :heavy_check_mark:                                                                     | Pagination details for the list                                                        |