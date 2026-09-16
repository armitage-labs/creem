# UpdateWebhookRequestEntity

## Example Usage

```typescript
import { UpdateWebhookRequestEntity } from "creem/models/components";

let value: UpdateWebhookRequestEntity = {
  url: "https://example.com/webhooks/creem",
  name: "Production billing events",
};
```

## Fields

| Field                                                                                                      | Type                                                                                                       | Required                                                                                                   | Description                                                                                                | Example                                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `url`                                                                                                      | *string*                                                                                                   | :heavy_minus_sign:                                                                                         | The HTTPS URL Creem will deliver events to.                                                                | https://example.com/webhooks/creem                                                                         |
| `name`                                                                                                     | *string*                                                                                                   | :heavy_minus_sign:                                                                                         | A human-readable label for the endpoint. Send `null` to clear it.                                          | Production billing events                                                                                  |
| `status`                                                                                                   | [components.WebhookStatus](../../models/components/webhookstatus.md)                                       | :heavy_minus_sign:                                                                                         | Whether the endpoint receives deliveries. Disabled endpoints keep their configuration but receive nothing. |                                                                                                            |
| `events`                                                                                                   | [components.WebhookEventType](../../models/components/webhookeventtype.md)[]                               | :heavy_minus_sign:                                                                                         | N/A                                                                                                        |                                                                                                            |