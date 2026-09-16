# CreateWebhookRequestEntity

## Example Usage

```typescript
import { CreateWebhookRequestEntity } from "creem/models/components";

let value: CreateWebhookRequestEntity = {
  url: "https://example.com/webhooks/creem",
  name: "Production billing events",
  events: [
    "checkout.completed",
    "subscription.paid",
  ],
};
```

## Fields

| Field                                                                        | Type                                                                         | Required                                                                     | Description                                                                  | Example                                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `url`                                                                        | *string*                                                                     | :heavy_check_mark:                                                           | The HTTPS URL Creem will deliver events to.                                  | https://example.com/webhooks/creem                                           |
| `name`                                                                       | *string*                                                                     | :heavy_minus_sign:                                                           | A human-readable label for the endpoint.                                     | Production billing events                                                    |
| `events`                                                                     | [components.WebhookEventType](../../models/components/webhookeventtype.md)[] | :heavy_minus_sign:                                                           | N/A                                                                          | [<br/>"checkout.completed",<br/>"subscription.paid"<br/>]                    |