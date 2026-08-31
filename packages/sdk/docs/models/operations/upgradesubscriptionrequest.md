# UpgradeSubscriptionRequest

## Example Usage

```typescript
import { UpgradeSubscriptionRequest } from "creem/models/operations";

let value: UpgradeSubscriptionRequest = {
  id: "<id>",
  upgradeSubscriptionRequestEntity: {
    productId: "prod_123",
  },
};
```

## Fields

| Field                                                                                                      | Type                                                                                                       | Required                                                                                                   | Description                                                                                                |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                       | *string*                                                                                                   | :heavy_check_mark:                                                                                         | The unique identifier of the subscription                                                                  |
| `upgradeSubscriptionRequestEntity`                                                                         | [components.UpgradeSubscriptionRequestEntity](../../models/components/upgradesubscriptionrequestentity.md) | :heavy_check_mark:                                                                                         | Subscription upgrade payload                                                                               |