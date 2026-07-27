# UpdateProductRequest

## Example Usage

```typescript
import { UpdateProductRequest } from "creem/models/operations";

let value: UpdateProductRequest = {
  id: "<id>",
  updateProductRequestEntity: {},
};
```

## Fields

| Field                                                                                          | Type                                                                                           | Required                                                                                       | Description                                                                                    |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `id`                                                                                           | *string*                                                                                       | :heavy_check_mark:                                                                             | The product ID                                                                                 |
| `updateProductRequestEntity`                                                                   | [components.UpdateProductRequestEntity](../../models/components/updateproductrequestentity.md) | :heavy_check_mark:                                                                             | Product update payload                                                                         |