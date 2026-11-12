# DebitCustomerCreditsAccountRequest

## Example Usage

```typescript
import { DebitCustomerCreditsAccountRequest } from "creem/models/operations";

let value: DebitCustomerCreditsAccountRequest = {
  id: "<id>",
  debitRequestDto: {
    amount: "1000",
    reference: "signup_bonus",
    idempotencyKey: "idem_abc123",
    moderationId: "3f1c2b9e-8d4a-4c7e-9b1a-2e5f6d7c8a90",
  },
};
```

## Fields

| Field                                                                    | Type                                                                     | Required                                                                 | Description                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `id`                                                                     | *string*                                                                 | :heavy_check_mark:                                                       | N/A                                                                      |
| `debitRequestDto`                                                        | [components.DebitRequestDto](../../models/components/debitrequestdto.md) | :heavy_check_mark:                                                       | N/A                                                                      |