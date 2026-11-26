# RemoveProductFromProductGroupRequest

## Example Usage

```typescript
import { RemoveProductFromProductGroupRequest } from "creem/models/operations";

let value: RemoveProductFromProductGroupRequest = {
  id: "<id>",
  productId: "<id>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `id`                            | *string*                        | :heavy_check_mark:              | The product group ID            |
| `productId`                     | *string*                        | :heavy_check_mark:              | The ID of the product to remove |