# SplitEntity

## Example Usage

```typescript
import { SplitEntity } from "creem/models/components";

let value: SplitEntity = {
  id: "<id>",
  mode: "prod",
  object: "split",
  storeId: "store_1a2b3c4d",
  description: "Q3 revenue share",
  type: "store",
  typeReference: "prod_1a2b3c4d",
  enabled: true,
  recipients: [
    {
      type: "percentage",
      recipientType: "store",
      recipientReference: "store_1a2b3c4d",
      amount: 25,
      enabled: true,
      inviteStatus: "pending",
    },
  ],
  createdAt: 1735689600000,
};
```

## Fields

| Field                                                                                                                          | Type                                                                                                                           | Required                                                                                                                       | Description                                                                                                                    | Example                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                           | *string*                                                                                                                       | :heavy_check_mark:                                                                                                             | Unique identifier for the object.                                                                                              |                                                                                                                                |
| `mode`                                                                                                                         | [components.EnvironmentMode](../../models/components/environmentmode.md)                                                       | :heavy_check_mark:                                                                                                             | String representing the environment.                                                                                           |                                                                                                                                |
| `object`                                                                                                                       | *string*                                                                                                                       | :heavy_check_mark:                                                                                                             | String representing the object's type. Objects of the same type share the same value.                                          | split                                                                                                                          |
| `storeId`                                                                                                                      | *string*                                                                                                                       | :heavy_check_mark:                                                                                                             | The id of the store that owns this split.                                                                                      | store_1a2b3c4d                                                                                                                 |
| `description`                                                                                                                  | *string*                                                                                                                       | :heavy_minus_sign:                                                                                                             | A human-readable description of the split.                                                                                     | Q3 revenue share                                                                                                               |
| `type`                                                                                                                         | [components.SplitEntityType](../../models/components/splitentitytype.md)                                                       | :heavy_check_mark:                                                                                                             | What the split applies to: `store` (every payment to the store) or `product` (payments for a specific product).                | store                                                                                                                          |
| `typeReference`                                                                                                                | *string*                                                                                                                       | :heavy_check_mark:                                                                                                             | The id of the entity the split applies to: the store id when `type` is `store`, or the product id when `type` is `product`.    | prod_1a2b3c4d                                                                                                                  |
| `enabled`                                                                                                                      | *boolean*                                                                                                                      | :heavy_check_mark:                                                                                                             | Whether the split is active. A split created with email invitees starts disabled and activates once the first invitee accepts. | true                                                                                                                           |
| `recipients`                                                                                                                   | [components.SplitRecipientEntity](../../models/components/splitrecipiententity.md)[]                                           | :heavy_check_mark:                                                                                                             | The recipients of the split and their shares.                                                                                  |                                                                                                                                |
| `createdAt`                                                                                                                    | *number*                                                                                                                       | :heavy_check_mark:                                                                                                             | Creation date of the split as a timestamp.                                                                                     | 1735689600000                                                                                                                  |