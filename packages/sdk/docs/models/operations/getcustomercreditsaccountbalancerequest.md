# GetCustomerCreditsAccountBalanceRequest

## Example Usage

```typescript
import { GetCustomerCreditsAccountBalanceRequest } from "creem/models/operations";

let value: GetCustomerCreditsAccountBalanceRequest = {
  id: "<id>",
  at: "2024-01-15T00:00:00.000Z",
};
```

## Fields

| Field                                                                                                         | Type                                                                                                          | Required                                                                                                      | Description                                                                                                   | Example                                                                                                       |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                          | *string*                                                                                                      | :heavy_check_mark:                                                                                            | N/A                                                                                                           |                                                                                                               |
| `at`                                                                                                          | *string*                                                                                                      | :heavy_minus_sign:                                                                                            | ISO 8601 date. If present, computes balance at that point in time. If absent, returns O(1) projected balance. | 2024-01-15T00:00:00.000Z                                                                                      |