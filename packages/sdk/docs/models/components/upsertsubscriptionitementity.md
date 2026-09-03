# UpsertSubscriptionItemEntity

## Example Usage

```typescript
import { UpsertSubscriptionItemEntity } from "creem/models/components";

let value: UpsertSubscriptionItemEntity = {};
```

## Fields

| Field                                                        | Type                                                         | Required                                                     | Description                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `id`                                                         | *string*                                                     | :heavy_minus_sign:                                           | The id of the item to update.                                |
| `productId`                                                  | *string*                                                     | :heavy_minus_sign:                                           | The ID of the product associated with the subscription item. |
| `priceId`                                                    | *string*                                                     | :heavy_minus_sign:                                           | The ID of the price associated with the subscription item.   |
| `units`                                                      | *number*                                                     | :heavy_minus_sign:                                           | The number of units for the subscription item.               |