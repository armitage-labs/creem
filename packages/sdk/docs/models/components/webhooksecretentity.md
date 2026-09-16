# WebhookSecretEntity

## Example Usage

```typescript
import { WebhookSecretEntity } from "creem/models/components";

let value: WebhookSecretEntity = {
  secret: "whsec_xxxxxxxxxxxxxxxxxxxx",
};
```

## Fields

| Field                                                                                          | Type                                                                                           | Required                                                                                       | Description                                                                                    | Example                                                                                        |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `secret`                                                                                       | *string*                                                                                       | :heavy_check_mark:                                                                             | The signing secret for this endpoint. Use it to verify the signature header on every delivery. | whsec_xxxxxxxxxxxxxxxxxxxx                                                                     |