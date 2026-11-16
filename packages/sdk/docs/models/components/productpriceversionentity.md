# ProductPriceVersionEntity

## Example Usage

```typescript
import { ProductPriceVersionEntity } from "creem/models/components";

let value: ProductPriceVersionEntity = {
  id: "pprice_abc",
  price: 2900,
  currency: "EUR",
  billingType: "recurring",
  billingPeriod: "every-day",
  recurringInterval: "<value>",
  recurringIntervalCount: 297156,
  pricingModel: "standard",
  createdAt: new Date("2023-01-01T00:00:00Z"),
  current: true,
  subscriptions: {
    total: 7945.56,
    byStatus: {
      active: 9,
      trialing: 1,
      pastDue: 1,
      scheduledCancel: 0,
      paused: 1,
      unpaid: 0,
    },
  },
};
```

## Fields

| Field                                                                                                               | Type                                                                                                                | Required                                                                                                            | Description                                                                                                         | Example                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                | *string*                                                                                                            | :heavy_check_mark:                                                                                                  | Unique identifier of the price version.                                                                             | pprice_abc                                                                                                          |
| `price`                                                                                                             | *number*                                                                                                            | :heavy_check_mark:                                                                                                  | The price of this version in cents. 1000 = $10.00                                                                   | 2900                                                                                                                |
| `currency`                                                                                                          | *string*                                                                                                            | :heavy_check_mark:                                                                                                  | Three-letter ISO currency code, in uppercase.                                                                       | EUR                                                                                                                 |
| `billingType`                                                                                                       | [components.ProductBillingType](../../models/components/productbillingtype.md)                                      | :heavy_check_mark:                                                                                                  | Indicates the billing method for the customer. It can either be a `recurring` billing cycle or a `onetime` payment. |                                                                                                                     |
| `billingPeriod`                                                                                                     | [components.ProductBillingPeriod](../../models/components/productbillingperiod.md)                                  | :heavy_check_mark:                                                                                                  | Billing period                                                                                                      |                                                                                                                     |
| `recurringInterval`                                                                                                 | *string*                                                                                                            | :heavy_check_mark:                                                                                                  | Unit of the billing interval (`day`, `week`, `month` or `year`). `null` for a one-time version.                     |                                                                                                                     |
| `recurringIntervalCount`                                                                                            | *number*                                                                                                            | :heavy_check_mark:                                                                                                  | Number of `recurring_interval` units per billing cycle. `null` for a one-time version.                              |                                                                                                                     |
| `pricingModel`                                                                                                      | [components.ProductPriceVersionPricingModel](../../models/components/productpriceversionpricingmodel.md)            | :heavy_check_mark:                                                                                                  | How this version is priced.                                                                                         |                                                                                                                     |
| `createdAt`                                                                                                         | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)                       | :heavy_check_mark:                                                                                                  | When this version was created.                                                                                      | 2023-01-01T00:00:00Z                                                                                                |
| `current`                                                                                                           | *boolean*                                                                                                           | :heavy_check_mark:                                                                                                  | Whether new purchases get it. True on exactly one version in a non-empty list.                                      |                                                                                                                     |
| `subscriptions`                                                                                                     | [components.RunningSubscriptionCountsEntity](../../models/components/runningsubscriptioncountsentity.md)            | :heavy_check_mark:                                                                                                  | Running subscriptions billed on this version. One with items on several versions counts on each.                    |                                                                                                                     |