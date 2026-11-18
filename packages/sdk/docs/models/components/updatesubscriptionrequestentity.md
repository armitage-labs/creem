# UpdateSubscriptionRequestEntity

## Example Usage

```typescript
import { UpdateSubscriptionRequestEntity } from "creem/models/components";

let value: UpdateSubscriptionRequestEntity = {};
```

## Fields

| Field                                                                                                                                                      | Type                                                                                                                                                       | Required                                                                                                                                                   | Description                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`                                                                                                                                                    | [components.UpsertSubscriptionItemEntity](../../models/components/upsertsubscriptionitementity.md)[]                                                       | :heavy_minus_sign:                                                                                                                                         | List of subscription items to update. Each item must include the id of an existing subscription item; adding new items to a subscription is not supported. |
| `updateBehavior`                                                                                                                                           | [components.UpdateBehavior](../../models/components/updatebehavior.md)                                                                                     | :heavy_minus_sign:                                                                                                                                         | The update behavior for the subscription (defaults to proration)                                                                                           |