# EntryInputDto

## Example Usage

```typescript
import { EntryInputDto } from "creem/models/components";

let value: EntryInputDto = {
  accountId: "cca_abc123",
  side: "credit",
  amount: "1000",
};
```

## Fields

| Field                                                                        | Type                                                                         | Required                                                                     | Description                                                                  | Example                                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `accountId`                                                                  | *string*                                                                     | :heavy_check_mark:                                                           | The account ID for this entry                                                | cca_abc123                                                                   |
| `side`                                                                       | [components.EntryInputDtoSide](../../models/components/entryinputdtoside.md) | :heavy_check_mark:                                                           | Debit or credit side                                                         |                                                                              |
| `amount`                                                                     | *string*                                                                     | :heavy_check_mark:                                                           | Entry amount (string to support large numbers)                               | 1000                                                                         |