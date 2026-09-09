# ListAffiliatesResponse

## Example Usage

```typescript
import { ListAffiliatesResponse } from "creem/models/operations";

let value: ListAffiliatesResponse = {
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

| Field                                                                            | Type                                                                             | Required                                                                         | Description                                                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `result`                                                                         | [components.AffiliateListEntity](../../models/components/affiliatelistentity.md) | :heavy_check_mark:                                                               | N/A                                                                              |