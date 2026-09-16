# ListWebhooksResponse

## Example Usage

```typescript
import { ListWebhooksResponse } from "creem/models/operations";

let value: ListWebhooksResponse = {
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

| Field                                                                        | Type                                                                         | Required                                                                     | Description                                                                  |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `result`                                                                     | [components.WebhookListEntity](../../models/components/webhooklistentity.md) | :heavy_check_mark:                                                           | N/A                                                                          |