# SubscriptionItemEntity

## Example Usage

```typescript
import { SubscriptionItemEntity } from "creem/models/components";

let value: SubscriptionItemEntity = {
  id: "<id>",
  mode: "test",
  object: "<value>",
};
```

## Fields

| Field                                                                                 | Type                                                                                  | Required                                                                              | Description                                                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `id`                                                                                  | *string*                                                                              | :heavy_check_mark:                                                                    | Unique identifier for the object.                                                     |
| `mode`                                                                                | [components.EnvironmentMode](../../models/components/environmentmode.md)              | :heavy_check_mark:                                                                    | String representing the environment.                                                  |
| `object`                                                                              | *string*                                                                              | :heavy_check_mark:                                                                    | String representing the object’s type. Objects of the same type share the same value. |
| `productId`                                                                           | *string*                                                                              | :heavy_minus_sign:                                                                    | The ID of the product associated with the subscription item.                          |
| `priceId`                                                                             | *string*                                                                              | :heavy_minus_sign:                                                                    | The ID of the price associated with the subscription item.                            |
| `units`                                                                               | *number*                                                                              | :heavy_minus_sign:                                                                    | The number of units for the subscription item.                                        |