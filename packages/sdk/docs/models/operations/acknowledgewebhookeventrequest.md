# AcknowledgeWebhookEventRequest

## Example Usage

```typescript
import { AcknowledgeWebhookEventRequest } from "creem/models/operations";

let value: AcknowledgeWebhookEventRequest = {
  id: "<id>",
  eventId: "<id>",
  acknowledgeWebhookEventRequestEntity: {
    statusCode: 200,
    responseBody: "OK",
  },
};
```

## Fields

| Field                                                                                                              | Type                                                                                                               | Required                                                                                                           | Description                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                               | *string*                                                                                                           | :heavy_check_mark:                                                                                                 | The webhook ID                                                                                                     |
| `eventId`                                                                                                          | *string*                                                                                                           | :heavy_check_mark:                                                                                                 | The event ID from the pending feed                                                                                 |
| `acknowledgeWebhookEventRequestEntity`                                                                             | [components.AcknowledgeWebhookEventRequestEntity](../../models/components/acknowledgewebhookeventrequestentity.md) | :heavy_check_mark:                                                                                                 | The local delivery result                                                                                          |