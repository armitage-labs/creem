# ReverseCustomerCreditsAccountTransactionRequest

## Example Usage

```typescript
import { ReverseCustomerCreditsAccountTransactionRequest } from "creem/models/operations";

let value: ReverseCustomerCreditsAccountTransactionRequest = {
  id: "<id>",
  reverseTransactionRequestDto: {
    transactionId: "cct_abc123",
  },
};
```

## Fields

| Field                                                                                              | Type                                                                                               | Required                                                                                           | Description                                                                                        |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `id`                                                                                               | *string*                                                                                           | :heavy_check_mark:                                                                                 | N/A                                                                                                |
| `reverseTransactionRequestDto`                                                                     | [components.ReverseTransactionRequestDto](../../models/components/reversetransactionrequestdto.md) | :heavy_check_mark:                                                                                 | N/A                                                                                                |