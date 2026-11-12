# TransactionResponseDto

## Example Usage

```typescript
import { TransactionResponseDto } from "creem/models/components";

let value: TransactionResponseDto = {
  id: "cct_abc123",
  storeId: "<id>",
  reference: "order_xyz",
  idempotencyKey: "<value>",
  reversalOf: "cct_abc123",
  moderationId: "3f1c2b9e-8d4a-4c7e-9b1a-2e5f6d7c8a90",
  entries: [],
  createdAt: "1723404814926",
};
```

## Fields

| Field                                                                               | Type                                                                                | Required                                                                            | Description                                                                         | Example                                                                             |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `id`                                                                                | *string*                                                                            | :heavy_check_mark:                                                                  | Transaction ID                                                                      | cct_abc123                                                                          |
| `storeId`                                                                           | *string*                                                                            | :heavy_check_mark:                                                                  | Store ID                                                                            |                                                                                     |
| `reference`                                                                         | *string*                                                                            | :heavy_check_mark:                                                                  | Reference string                                                                    | order_xyz                                                                           |
| `idempotencyKey`                                                                    | *string*                                                                            | :heavy_check_mark:                                                                  | Idempotency key                                                                     |                                                                                     |
| `reversalOf`                                                                        | *string*                                                                            | :heavy_minus_sign:                                                                  | ID of the transaction this reverses, if applicable                                  | cct_abc123                                                                          |
| `moderationId`                                                                      | *string*                                                                            | :heavy_check_mark:                                                                  | ID of the Moderation API result linked to this transaction, if one was sent with it | 3f1c2b9e-8d4a-4c7e-9b1a-2e5f6d7c8a90                                                |
| `entries`                                                                           | [components.EntryResponseDto](../../models/components/entryresponsedto.md)[]        | :heavy_check_mark:                                                                  | Transaction entries                                                                 |                                                                                     |
| `createdAt`                                                                         | *string*                                                                            | :heavy_check_mark:                                                                  | Creation timestamp                                                                  |                                                                                     |