# WebhookEventAckEntity

## Example Usage

```typescript
import { WebhookEventAckEntity } from "creem/models/components";

let value: WebhookEventAckEntity = {
  id: "evt_5Xb2mQ7vN1pLk9RtYw3zA",
  object: "webhook_event",
  success: true,
};
```

## Fields

| Field                                                                                   | Type                                                                                    | Required                                                                                | Description                                                                             | Example                                                                                 |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `id`                                                                                    | *string*                                                                                | :heavy_check_mark:                                                                      | The acknowledged event ID.                                                              | evt_5Xb2mQ7vN1pLk9RtYw3zA                                                               |
| `object`                                                                                | *string*                                                                                | :heavy_check_mark:                                                                      | A string representing the object’s type. Objects of the same type share the same value. | webhook_event                                                                           |
| `success`                                                                               | *boolean*                                                                               | :heavy_check_mark:                                                                      | Whether the reported status code counts as a successful delivery (any 2xx).             | true                                                                                    |