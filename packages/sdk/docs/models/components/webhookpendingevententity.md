# WebhookPendingEventEntity

## Example Usage

```typescript
import { WebhookPendingEventEntity } from "creem/models/components";

let value: WebhookPendingEventEntity = {
  id: "evt_5Xb2mQ7vN1pLk9RtYw3zA",
  object: "webhook_event",
  eventType: "subscription.update",
  createdAt: new Date("2026-09-17T08:00:00.000Z"),
  body:
    "{\"id\":\"evt_5Xb2mQ7vN1pLk9RtYw3zA\",\"eventType\":\"checkout.completed\",\"created_at\":1758096000000,\"object\":{\"id\":\"ch_...\"}}",
  headers: {
    "creem-signature": "a1b2c3…",
    "Content-Type": "application/json",
  },
};
```

## Fields

| Field                                                                                                                     | Type                                                                                                                      | Required                                                                                                                  | Description                                                                                                               | Example                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                      | *string*                                                                                                                  | :heavy_check_mark:                                                                                                        | The event ID. Acknowledge the delivery with this ID.                                                                      | evt_5Xb2mQ7vN1pLk9RtYw3zA                                                                                                 |
| `object`                                                                                                                  | *string*                                                                                                                  | :heavy_check_mark:                                                                                                        | A string representing the object’s type. Objects of the same type share the same value.                                   | webhook_event                                                                                                             |
| `eventType`                                                                                                               | [components.WebhookEventType](../../models/components/webhookeventtype.md)                                                | :heavy_check_mark:                                                                                                        | The event type carried in the delivery.                                                                                   |                                                                                                                           |
| `createdAt`                                                                                                               | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)                             | :heavy_check_mark:                                                                                                        | When the event was recorded for this endpoint.                                                                            | 2026-09-17T08:00:00.000Z                                                                                                  |
| `body`                                                                                                                    | *string*                                                                                                                  | :heavy_check_mark:                                                                                                        | The exact JSON request body of the delivery. Forward it byte-for-byte; the signature header is computed over this string. | {"id":"evt_5Xb2mQ7vN1pLk9RtYw3zA","eventType":"checkout.completed","created_at":1758096000000,"object":{"id":"ch_..."}}   |
| `headers`                                                                                                                 | Record<string, *string*>                                                                                                  | :heavy_check_mark:                                                                                                        | The HTTP headers a real delivery would carry, including `creem-signature`. Send them unchanged with `body`.               | {<br/>"creem-signature": "a1b2c3…",<br/>"Content-Type": "application/json"<br/>}                                          |