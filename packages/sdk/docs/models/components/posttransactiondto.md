# PostTransactionDto

## Example Usage

```typescript
import { PostTransactionDto } from "creem/models/components";

let value: PostTransactionDto = {
  reference: "order_xyz",
  idempotencyKey: "idem_abc123",
  entries: [],
};
```

## Fields

| Field                                                                                         | Type                                                                                          | Required                                                                                      | Description                                                                                   | Example                                                                                       |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `reference`                                                                                   | *string*                                                                                      | :heavy_check_mark:                                                                            | Your reference ID to link this transaction to an event in your system                         | order_xyz                                                                                     |
| `idempotencyKey`                                                                              | *string*                                                                                      | :heavy_check_mark:                                                                            | Idempotency key to prevent duplicate transactions                                             | idem_abc123                                                                                   |
| `entries`                                                                                     | [components.EntryInputDto](../../models/components/entryinputdto.md)[]                        | :heavy_check_mark:                                                                            | Array of entries. Must have at least 2 entries and the total debits must equal total credits. |                                                                                               |