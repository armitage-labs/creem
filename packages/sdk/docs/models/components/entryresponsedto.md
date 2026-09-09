# EntryResponseDto

## Example Usage

```typescript
import { EntryResponseDto } from "creem/models/components";

let value: EntryResponseDto = {
  id: "cce_abc123",
  transactionId: "cct_abc123",
  accountId: "cca_abc123",
  side: "credit",
  amount: "1000",
  createdAt: "1733359457295",
};
```

## Fields

| Field                                              | Type                                               | Required                                           | Description                                        | Example                                            |
| -------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| `id`                                               | *string*                                           | :heavy_check_mark:                                 | Entry ID                                           | cce_abc123                                         |
| `transactionId`                                    | *string*                                           | :heavy_check_mark:                                 | Transaction ID                                     | cct_abc123                                         |
| `accountId`                                        | *string*                                           | :heavy_check_mark:                                 | Account ID                                         | cca_abc123                                         |
| `side`                                             | [components.Side](../../models/components/side.md) | :heavy_check_mark:                                 | Debit or credit side                               |                                                    |
| `amount`                                           | *string*                                           | :heavy_check_mark:                                 | Amount as string for bigint safety                 | 1000                                               |
| `createdAt`                                        | *string*                                           | :heavy_check_mark:                                 | Creation timestamp                                 |                                                    |