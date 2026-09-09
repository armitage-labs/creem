# AffiliateListEntity

## Example Usage

```typescript
import { AffiliateListEntity } from "creem/models/components";

let value: AffiliateListEntity = {
  items: [
    {
      id: "<id>",
      mode: "test",
      object: "affiliate",
      email: "partner@example.com",
      name: "Jane Partner",
      status: "active",
      referralCode: "a1b2c3d4",
      referralLink: "https://creem.io/affiliate?code=a1b2c3d4",
      clicks: 128,
      conversions: 12,
      earnings: 4200,
      currency: "USD",
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
| `items`                                                                    | [components.AffiliateEntity](../../models/components/affiliateentity.md)[] | :heavy_check_mark:                                                         | List of affiliate items                                                    |
| `pagination`                                                               | [components.PaginationEntity](../../models/components/paginationentity.md) | :heavy_check_mark:                                                         | Pagination details for the list                                            |