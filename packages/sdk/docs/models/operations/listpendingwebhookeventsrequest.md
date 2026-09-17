# ListPendingWebhookEventsRequest

## Example Usage

```typescript
import { ListPendingWebhookEventsRequest } from "creem/models/operations";

let value: ListPendingWebhookEventsRequest = {
  id: "<id>",
};
```

## Fields

| Field                                       | Type                                        | Required                                    | Description                                 |
| ------------------------------------------- | ------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| `id`                                        | *string*                                    | :heavy_check_mark:                          | The webhook ID                              |
| `limit`                                     | *number*                                    | :heavy_minus_sign:                          | Maximum number of pending events to return. |