# ProductPriceVersionListEntity

## Example Usage

```typescript
import { ProductPriceVersionListEntity } from "creem/models/components";

let value: ProductPriceVersionListEntity = {
  items: [],
  subscriptionsWithoutPriceVersion: {
    total: 1121.52,
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

| Field                                                                                                                          | Type                                                                                                                           | Required                                                                                                                       | Description                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `items`                                                                                                                        | [components.ProductPriceVersionEntity](../../models/components/productpriceversionentity.md)[]                                 | :heavy_check_mark:                                                                                                             | Every price version, newest first. Empty for a legacy product with no price rows. Usage prices are unversioned and not listed. |
| `subscriptionsWithoutPriceVersion`                                                                                             | [components.RunningSubscriptionCountsEntity](../../models/components/runningsubscriptioncountsentity.md)                       | :heavy_check_mark:                                                                                                             | Running subscriptions not billed on any listed version.                                                                        |