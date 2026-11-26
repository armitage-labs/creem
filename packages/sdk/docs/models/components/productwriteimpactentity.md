# ProductWriteImpactEntity

## Example Usage

```typescript
import { ProductWriteImpactEntity } from "creem/models/components";

let value: ProductWriteImpactEntity = {
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
};
```

## Fields

| Field                                                                                                                                                                            | Type                                                                                                                                                                             | Required                                                                                                                                                                         | Description                                                                                                                                                                      | Example                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `total`                                                                                                                                                                          | *number*                                                                                                                                                                         | :heavy_check_mark:                                                                                                                                                               | Running subscriptions, the sum of `by_status`.                                                                                                                                   | 12                                                                                                                                                                               |
| `byStatus`                                                                                                                                                                       | Record<string, *number*>                                                                                                                                                         | :heavy_check_mark:                                                                                                                                                               | Running subscriptions per status. Always lists `active`, `trialing`, `past_due`, `scheduled_cancel`, `paused` and `unpaid`.                                                      | {<br/>"active": 9,<br/>"trialing": 1,<br/>"past_due": 1,<br/>"scheduled_cancel": 0,<br/>"paused": 1,<br/>"unpaid": 0<br/>}                                                       |
| `unsettledPostpaidUsage`                                                                                                                                                         | *number*                                                                                                                                                                         | :heavy_minus_sign:                                                                                                                                                               | Subscriptions that are no longer running but have postpaid usage on this product that has not been billed yet; included in `total`. Present on changes of a usage price.         | 0                                                                                                                                                                                |
| `autoRechargeConsents`                                                                                                                                                           | *number*                                                                                                                                                                         | :heavy_minus_sign:                                                                                                                                                               | Enabled automatic refills (auto-recharge consents) of customers on this product. Present on a change of the price, currency, tax mode or billing terms when the product has any. | 3                                                                                                                                                                                |