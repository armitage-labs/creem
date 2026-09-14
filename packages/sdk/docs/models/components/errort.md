# ErrorT

Why the event is invalid. Null when valid.

## Example Usage

```typescript
import { ErrorT } from "creem/models/components";

let value: ErrorT = {
  code: "invalid_usage_event",
  message: "<value>",
  param: {},
};
```

## Fields

| Field                                                | Type                                                 | Required                                             | Description                                          | Example                                              |
| ---------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `code`                                               | *string*                                             | :heavy_check_mark:                                   | Validation error code                                | invalid_usage_event                                  |
| `message`                                            | *string*                                             | :heavy_check_mark:                                   | What is wrong with the event                         |                                                      |
| `param`                                              | [components.Param](../../models/components/param.md) | :heavy_minus_sign:                                   | The offending field, named as you sent it            | customer_id                                          |