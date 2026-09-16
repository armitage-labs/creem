# UpdateWebhookRequest

## Example Usage

```typescript
import { UpdateWebhookRequest } from "creem/models/operations";

let value: UpdateWebhookRequest = {
  id: "<id>",
  updateWebhookRequestEntity: {
    url: "https://example.com/webhooks/creem",
    name: "Production billing events",
  },
};
```

## Fields

| Field                                                                                          | Type                                                                                           | Required                                                                                       | Description                                                                                    |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `id`                                                                                           | *string*                                                                                       | :heavy_check_mark:                                                                             | The webhook ID                                                                                 |
| `updateWebhookRequestEntity`                                                                   | [components.UpdateWebhookRequestEntity](../../models/components/updatewebhookrequestentity.md) | :heavy_check_mark:                                                                             | Webhook endpoint update payload                                                                |