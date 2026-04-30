# TransactionResponseDto

## Example Usage

```typescript
import { TransactionResponseDto } from "creem/models/components";

let value: TransactionResponseDto = {
  id: "cct_abc123",
  storeId: "<id>",
  reference: "order_xyz",
  idempotencyKey: "<value>",
  reversalOf: {},
  entries: [],
  createdAt: "1723404814926",
};
```

## Fields

| Field                                                                        | Type                                                                         | Required                                                                     | Description                                                                  | Example                                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `id`                                                                         | *string*                                                                     | :heavy_check_mark:                                                           | Transaction ID                                                               | cct_abc123                                                                   |
| `storeId`                                                                    | *string*                                                                     | :heavy_check_mark:                                                           | Store ID                                                                     |                                                                              |
| `reference`                                                                  | *string*                                                                     | :heavy_check_mark:                                                           | Reference string                                                             | order_xyz                                                                    |
| `idempotencyKey`                                                             | *string*                                                                     | :heavy_check_mark:                                                           | Idempotency key                                                              |                                                                              |
| `reversalOf`                                                                 | [components.ReversalOf](../../models/components/reversalof.md)               | :heavy_minus_sign:                                                           | ID of the transaction this reverses, if applicable                           | cct_abc123                                                                   |
| `entries`                                                                    | [components.EntryResponseDto](../../models/components/entryresponsedto.md)[] | :heavy_check_mark:                                                           | Transaction entries                                                          |                                                                              |
| `createdAt`                                                                  | *string*                                                                     | :heavy_check_mark:                                                           | Creation timestamp                                                           |                                                                              |