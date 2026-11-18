# TooManyRequestsErrorEntity

## Example Usage

```typescript
import { TooManyRequestsErrorEntity } from "creem/models/errors";

// No examples available for this model
```

## Fields

| Field                                                                                   | Type                                                                                    | Required                                                                                | Description                                                                             | Example                                                                                 |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `traceId`                                                                               | *string*                                                                                | :heavy_check_mark:                                                                      | Identifier of this request, for support.                                                |                                                                                         |
| `status`                                                                                | *number*                                                                                | :heavy_check_mark:                                                                      | The HTTP status code.                                                                   | 429                                                                                     |
| `error`                                                                                 | *string*                                                                                | :heavy_check_mark:                                                                      | The HTTP status text.                                                                   | Too Many Requests                                                                       |
| `message`                                                                               | *string*[]                                                                              | :heavy_check_mark:                                                                      | What went wrong.                                                                        | [<br/>"A discount create with this idempotency key is already in progress. Please retry."<br/>] |
| `timestamp`                                                                             | *number*                                                                                | :heavy_check_mark:                                                                      | When the error occurred, in milliseconds since the Unix epoch.                          |                                                                                         |