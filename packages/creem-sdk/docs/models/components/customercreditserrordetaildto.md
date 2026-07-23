# CustomerCreditsErrorDetailDto

## Example Usage

```typescript
import { CustomerCreditsErrorDetailDto } from "creem/models/components";

let value: CustomerCreditsErrorDetailDto = {
  type: "invalid_request_error",
  code: "unbalanced_transaction",
  message: "Total debits must equal total credits",
  param: "entries",
  requestId: "req_abc123def456",
};
```

## Fields

| Field                                                                                                        | Type                                                                                                         | Required                                                                                                     | Description                                                                                                  | Example                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `type`                                                                                                       | [components.CustomerCreditsErrorDetailDtoType](../../models/components/customercreditserrordetaildtotype.md) | :heavy_check_mark:                                                                                           | Error category                                                                                               | invalid_request_error                                                                                        |
| `code`                                                                                                       | *string*                                                                                                     | :heavy_check_mark:                                                                                           | Machine-readable error code                                                                                  | unbalanced_transaction                                                                                       |
| `message`                                                                                                    | *string*                                                                                                     | :heavy_check_mark:                                                                                           | Human-readable error message                                                                                 | Total debits must equal total credits                                                                        |
| `param`                                                                                                      | *string*                                                                                                     | :heavy_minus_sign:                                                                                           | The parameter related to the error, if applicable                                                            | entries                                                                                                      |
| `requestId`                                                                                                  | *string*                                                                                                     | :heavy_check_mark:                                                                                           | Unique request identifier for support                                                                        | req_abc123def456                                                                                             |