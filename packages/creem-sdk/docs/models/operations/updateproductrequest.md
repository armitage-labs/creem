# UpdateProductRequest

## Example Usage

```typescript
import { UpdateProductRequest } from "creem/models/operations";

let value: UpdateProductRequest = {
  id: "<id>",
  updateProductRequestEntity: {
    imageUrl: "https://picsum.photos/200/300",
    defaultSuccessUrl: "https://example.com/?status=successful",
    price: 400,
    payWhatYouWant: false,
    suggestedPrice: 1500,
  },
};
```

## Fields

| Field                                                                                          | Type                                                                                           | Required                                                                                       | Description                                                                                    |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `id`                                                                                           | *string*                                                                                       | :heavy_check_mark:                                                                             | The product ID                                                                                 |
| `updateProductRequestEntity`                                                                   | [components.UpdateProductRequestEntity](../../models/components/updateproductrequestentity.md) | :heavy_check_mark:                                                                             | N/A                                                                                            |