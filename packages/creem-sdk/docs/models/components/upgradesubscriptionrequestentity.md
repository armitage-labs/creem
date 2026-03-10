# UpgradeSubscriptionRequestEntity

## Example Usage

```typescript
import { UpgradeSubscriptionRequestEntity } from "creem/models/components";

let value: UpgradeSubscriptionRequestEntity = {
  productId: "prod_123",
};
```

## Fields

| Field                                                                                                                                  | Type                                                                                                                                   | Required                                                                                                                               | Description                                                                                                                            | Example                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `productId`                                                                                                                            | *string*                                                                                                                               | :heavy_check_mark:                                                                                                                     | The ID of the product to upgrade to                                                                                                    | prod_123                                                                                                                               |
| `updateBehavior`                                                                                                                       | [components.UpgradeSubscriptionRequestEntityUpdateBehavior](../../models/components/upgradesubscriptionrequestentityupdatebehavior.md) | :heavy_minus_sign:                                                                                                                     | The update behavior for the subscription (defaults to proration-charge-immediately)                                                    |                                                                                                                                        |