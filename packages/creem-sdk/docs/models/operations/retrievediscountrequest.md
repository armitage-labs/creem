# RetrieveDiscountRequest

## Example Usage

```typescript
import { RetrieveDiscountRequest } from "creem/models/operations";

let value: RetrieveDiscountRequest = {
  discountId: "disc_1234567890",
  discountCode: "SAVE20",
};
```

## Fields

| Field                                                                                | Type                                                                                 | Required                                                                             | Description                                                                          | Example                                                                              |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `discountId`                                                                         | *string*                                                                             | :heavy_minus_sign:                                                                   | The unique identifier of the discount (provide either discount_id OR discount_code). | disc_1234567890                                                                      |
| `discountCode`                                                                       | *string*                                                                             | :heavy_minus_sign:                                                                   | The unique discount code (provide either discount_id OR discount_code).              | SAVE20                                                                               |