# AffiliateInviteListEntity

## Example Usage

```typescript
import { AffiliateInviteListEntity } from "creem/models/components";

let value: AffiliateInviteListEntity = {
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

| Field                                                                                  | Type                                                                                   | Required                                                                               | Description                                                                            |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `items`                                                                                | [components.AffiliateInviteEntity](../../models/components/affiliateinviteentity.md)[] | :heavy_check_mark:                                                                     | List of affiliate invitation items                                                     |
| `pagination`                                                                           | [components.PaginationEntity](../../models/components/paginationentity.md)             | :heavy_check_mark:                                                                     | Pagination details for the list                                                        |