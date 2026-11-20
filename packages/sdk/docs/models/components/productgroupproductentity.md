# ProductGroupProductEntity

## Example Usage

```typescript
import { ProductGroupProductEntity } from "creem/models/components";

let value: ProductGroupProductEntity = {
  id: "<id>",
  externalId: "<id>",
};
```

## Fields

| Field                                                     | Type                                                      | Required                                                  | Description                                               |
| --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `id`                                                      | *string*                                                  | :heavy_check_mark:                                        | The id of the product.                                    |
| `externalId`                                              | *string*                                                  | :heavy_check_mark:                                        | Your own key for the product, or `null` when it has none. |