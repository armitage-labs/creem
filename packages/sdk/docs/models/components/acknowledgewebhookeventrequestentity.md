# AcknowledgeWebhookEventRequestEntity

## Example Usage

```typescript
import { AcknowledgeWebhookEventRequestEntity } from "creem/models/components";

let value: AcknowledgeWebhookEventRequestEntity = {
  statusCode: 200,
  responseBody: "OK",
};
```

## Fields

| Field                                                                                                                                              | Type                                                                                                                                               | Required                                                                                                                                           | Description                                                                                                                                        | Example                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `statusCode`                                                                                                                                       | *number*                                                                                                                                           | :heavy_check_mark:                                                                                                                                 | The HTTP status code the local server answered with. Any 2xx marks the delivery successful. Report 503 when the local server could not be reached. | 200                                                                                                                                                |
| `responseBody`                                                                                                                                     | *string*                                                                                                                                           | :heavy_minus_sign:                                                                                                                                 | The response body the local server returned, truncated to 10,000 characters. Shown in the dashboard event log.                                     | OK                                                                                                                                                 |