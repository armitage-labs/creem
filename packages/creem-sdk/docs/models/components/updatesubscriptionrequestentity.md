# UpdateSubscriptionRequestEntity

## Example Usage

```typescript
import { UpdateSubscriptionRequestEntity } from "creem/models/components";

let value: UpdateSubscriptionRequestEntity = {};
```

## Fields

| Field                                                                                                | Type                                                                                                 | Required                                                                                             | Description                                                                                          |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `items`                                                                                              | [components.UpsertSubscriptionItemEntity](../../models/components/upsertsubscriptionitementity.md)[] | :heavy_minus_sign:                                                                                   | List of subscription items to update/create. If no item ID is provided, the item will be created.    |
| `updateBehavior`                                                                                     | [components.UpdateBehavior](../../models/components/updatebehavior.md)                               | :heavy_minus_sign:                                                                                   | The update behavior for the subscription (defaults to proration)                                     |