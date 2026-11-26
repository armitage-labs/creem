# AddProductToProductGroupRequest

## Example Usage

```typescript
import { AddProductToProductGroupRequest } from "creem/models/operations";

let value: AddProductToProductGroupRequest = {
  id: "<id>",
  requestBody: {
    externalId: "pro-monthly",
  },
};
```

## Fields

| Field                                            | Type                                             | Required                                         | Description                                      |
| ------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------ |
| `id`                                             | *string*                                         | :heavy_check_mark:                               | The product group ID                             |
| `requestBody`                                    | *operations.AddProductToProductGroupRequestBody* | :heavy_check_mark:                               | N/A                                              |