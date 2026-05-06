# BalanceResponseDto

## Example Usage

```typescript
import { BalanceResponseDto } from "creem/models/components";

let value: BalanceResponseDto = {
  balance: "5000",
};
```

## Fields

| Field                                                                   | Type                                                                    | Required                                                                | Description                                                             | Example                                                                 |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `balance`                                                               | *string*                                                                | :heavy_check_mark:                                                      | Current balance as string for bigint safety                             | 5000                                                                    |
| `updatedAt`                                                             | *string*                                                                | :heavy_minus_sign:                                                      | Last update timestamp (present for projected balance)                   |                                                                         |
| `asOf`                                                                  | *string*                                                                | :heavy_minus_sign:                                                      | Point-in-time the balance was computed at (present for at-time queries) |                                                                         |