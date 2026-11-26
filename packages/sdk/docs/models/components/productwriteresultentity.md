# ProductWriteResultEntity

## Example Usage

```typescript
import { ProductWriteResultEntity } from "creem/models/components";

let value: ProductWriteResultEntity = {
  result: "updated",
  dryRun: false,
  changes: [
    {
      path: "price",
      from: 2900,
      to: 3900,
      impact: {
        total: 12,
        byStatus: {
          "active": 9,
          "trialing": 1,
          "past_due": 1,
          "scheduled_cancel": 0,
          "paused": 1,
          "unpaid": 0,
        },
        unsettledPostpaidUsage: 0,
        autoRechargeConsents: 3,
      },
    },
  ],
  warnings: [
    {
      code: "usage_prices_shared",
      path: "currency",
      impact: {
        total: 12,
        byStatus: {
          "active": 9,
          "trialing": 1,
          "past_due": 1,
          "scheduled_cancel": 0,
          "paused": 1,
          "unpaid": 0,
        },
        unsettledPostpaidUsage: 0,
        autoRechargeConsents: 3,
      },
    },
  ],
  priceVersion: {
    created: true,
    previousPriceId: "pprice_old",
    newPriceId: "pprice_new",
    subscriptionsOnOlderPrices: {
      total: 12,
      byStatus: {
        "active": 9,
        "trialing": 1,
        "past_due": 1,
        "scheduled_cancel": 0,
        "paused": 1,
        "unpaid": 0,
      },
    },
  },
};
```

## Fields

| Field                                                                                                                                                                                                                         | Type                                                                                                                                                                                                                          | Required                                                                                                                                                                                                                      | Description                                                                                                                                                                                                                   | Example                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `result`                                                                                                                                                                                                                      | *string*                                                                                                                                                                                                                      | :heavy_check_mark:                                                                                                                                                                                                            | What the write did. Known values: `created`, `updated`, `unchanged` (the product already was what the request asked for; nothing was written). More values can be added, so treat a value you do not know like `updated`.     | updated                                                                                                                                                                                                                       |
| `dryRun`                                                                                                                                                                                                                      | *boolean*                                                                                                                                                                                                                     | :heavy_check_mark:                                                                                                                                                                                                            | `true` when the request was sent with `dry_run=true`: nothing was written, and the ids of anything the write would have created are never stored. `false` on a real write. Stop unless it is `true` when you meant a dry run. | false                                                                                                                                                                                                                         |
| `changes`                                                                                                                                                                                                                     | [components.ProductWriteChangeEntity](../../models/components/productwritechangeentity.md)[]                                                                                                                                  | :heavy_check_mark:                                                                                                                                                                                                            | What changed, field by field. Empty on a create and on `unchanged`.                                                                                                                                                           |                                                                                                                                                                                                                               |
| `warnings`                                                                                                                                                                                                                    | [components.ProductWriteWarningEntity](../../models/components/productwritewarningentity.md)[]                                                                                                                                | :heavy_check_mark:                                                                                                                                                                                                            | Things to know about this write. The write went through. Empty when there is nothing to report.                                                                                                                               |                                                                                                                                                                                                                               |
| `priceVersion`                                                                                                                                                                                                                | [components.ProductWritePriceVersionEntity](../../models/components/productwritepriceversionentity.md)                                                                                                                        | :heavy_minus_sign:                                                                                                                                                                                                            | Present only when the write created a new price version: a change of amount, currency, billing type, billing period or tax mode.                                                                                              |                                                                                                                                                                                                                               |