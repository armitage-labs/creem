# CreditCustomerCreditsAccountRequest

## Example Usage

```typescript
import { CreditCustomerCreditsAccountRequest } from "creem/models/operations";

let value: CreditCustomerCreditsAccountRequest = {
  id: "<id>",
  creditDebitRequestDto: {
    amount: "1000",
    reference: "signup_bonus",
    idempotencyKey: "idem_abc123",
  },
};
```

## Fields

| Field                                                                                | Type                                                                                 | Required                                                                             | Description                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `id`                                                                                 | *string*                                                                             | :heavy_check_mark:                                                                   | N/A                                                                                  |
| `creditDebitRequestDto`                                                              | [components.CreditDebitRequestDto](../../models/components/creditdebitrequestdto.md) | :heavy_check_mark:                                                                   | N/A                                                                                  |