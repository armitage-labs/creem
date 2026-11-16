# MarketplaceGrantAskEntityOrder

The paid order the ask is for. null on a test ask (test: true) from the review gate, which has no order.

## Example Usage

```typescript
import { MarketplaceGrantAskEntityOrder } from "creem/models/components";

let value: MarketplaceGrantAskEntityOrder = {
  id: "<id>",
  status: "<value>",
  amountMinor: 3557.52,
  currency: "Kenyan Shilling",
  transactionId: {},
  paidAt: null,
};
```

## Fields

| Field                                                                | Type                                                                 | Required                                                             | Description                                                          |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `id`                                                                 | *string*                                                             | :heavy_check_mark:                                                   | N/A                                                                  |
| `status`                                                             | *string*                                                             | :heavy_check_mark:                                                   | N/A                                                                  |
| `amountMinor`                                                        | *number*                                                             | :heavy_check_mark:                                                   | What the buyer was charged, minor units.                             |
| `currency`                                                           | *string*                                                             | :heavy_check_mark:                                                   | N/A                                                                  |
| `transactionId`                                                      | [components.TransactionId](../../models/components/transactionid.md) | :heavy_check_mark:                                                   | N/A                                                                  |
| `paidAt`                                                             | [components.PaidAt](../../models/components/paidat.md)               | :heavy_check_mark:                                                   | N/A                                                                  |