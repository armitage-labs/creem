# ListAffiliateInvitesResponse

## Example Usage

```typescript
import { ListAffiliateInvitesResponse } from "creem/models/operations";

let value: ListAffiliateInvitesResponse = {
  result: {
    items: [
      {
        id: "<id>",
        mode: "sandbox",
        object: "affiliate-invite",
        email: "partner@example.com",
        name: "Jane Partner",
        status: "pending",
        createdAt: 9261.98,
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

| Field                                                                                        | Type                                                                                         | Required                                                                                     | Description                                                                                  |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `result`                                                                                     | [components.AffiliateInviteListEntity](../../models/components/affiliateinvitelistentity.md) | :heavy_check_mark:                                                                           | N/A                                                                                          |