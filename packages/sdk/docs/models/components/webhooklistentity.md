# WebhookListEntity

## Example Usage

```typescript
import { WebhookListEntity } from "creem/models/components";

let value: WebhookListEntity = {
  items: [
    {
      id: "<id>",
      mode: "sandbox",
      object: "webhook",
      storeId: "sto_1234567890",
      name: "Production billing events",
      url: "https://example.com/webhooks/creem",
      deliveryMode: "http",
      status: "enabled",
      events: [
        "checkout.completed",
        "subscription.paid",
      ],
      secret: "whsec_xxxxxxxxxxxxxxxxxxxx",
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
| `items`                                                                    | [components.WebhookEntity](../../models/components/webhookentity.md)[]     | :heavy_check_mark:                                                         | List of webhook endpoints                                                  |
| `pagination`                                                               | [components.PaginationEntity](../../models/components/paginationentity.md) | :heavy_check_mark:                                                         | Pagination details for the list                                            |