# ProductGroupListEntity

## Example Usage

```typescript
import { ProductGroupListEntity } from "creem/models/components";

let value: ProductGroupListEntity = {
  object: "list",
  data: [
    {
      id: "<id>",
      mode: "sandbox",
      object: "product_group",
      name: "<value>",
      description: "bah smoothly brave offset at rebuke",
      externalId: "<id>",
      products: [
        {
          id: "<id>",
          externalId: null,
        },
      ],
      upgradesEnabled: true,
      upgradeBehavior: "proration-charge-immediately",
      upsellsEnabled: true,
      isActive: false,
      createdAt: new Date("2023-01-01T00:00:00Z"),
      updatedAt: new Date("2023-01-01T00:00:00Z"),
    },
  ],
  hasMore: false,
};
```

## Fields

| Field                                                                            | Type                                                                             | Required                                                                         | Description                                                                      | Example                                                                          |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `object`                                                                         | *string*                                                                         | :heavy_check_mark:                                                               | Object type                                                                      | list                                                                             |
| `data`                                                                           | [components.ProductGroupEntity](../../models/components/productgroupentity.md)[] | :heavy_check_mark:                                                               | The product groups of this page.                                                 |                                                                                  |
| `hasMore`                                                                        | *boolean*                                                                        | :heavy_check_mark:                                                               | Whether more items exist beyond this page.                                       |                                                                                  |