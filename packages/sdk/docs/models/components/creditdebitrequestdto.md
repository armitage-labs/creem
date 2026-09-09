# CreditDebitRequestDto

## Example Usage

```typescript
import { CreditDebitRequestDto } from "creem/models/components";

let value: CreditDebitRequestDto = {
  amount: "1000",
  reference: "signup_bonus",
  idempotencyKey: "idem_abc123",
};
```

## Fields

| Field                                                                                              | Type                                                                                               | Required                                                                                           | Description                                                                                        | Example                                                                                            |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `amount`                                                                                           | *string*                                                                                           | :heavy_check_mark:                                                                                 | Amount to credit or debit (string to support large numbers)                                        | 1000                                                                                               |
| `reference`                                                                                        | *string*                                                                                           | :heavy_check_mark:                                                                                 | Your reference ID to link this transaction to an event in your system (e.g. order ID, campaign ID) | signup_bonus                                                                                       |
| `idempotencyKey`                                                                                   | *string*                                                                                           | :heavy_check_mark:                                                                                 | Idempotency key to prevent duplicate transactions                                                  | idem_abc123                                                                                        |