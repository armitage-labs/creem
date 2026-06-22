# CheckoutEntityDiscount

The discount applied to the checkout, if any.

## Example Usage

```typescript
import { CheckoutEntityDiscount } from "creem/models/components";

let value: CheckoutEntityDiscount = {
  id: "dis_3e6Z6TzvHKdsjEgXnGDEp0",
  discountCode: "HOLIDAY2024",
};
```

## Fields

| Field                                                                                  | Type                                                                                   | Required                                                                               | Description                                                                            | Example                                                                                |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `id`                                                                                   | *string*                                                                               | :heavy_minus_sign:                                                                     | The unique identifier of the discount (e.g. dis_...).                                  | dis_3e6Z6TzvHKdsjEgXnGDEp0                                                             |
| `discountCode`                                                                         | *string*                                                                               | :heavy_minus_sign:                                                                     | The discount code applied to the checkout.                                             | HOLIDAY2024                                                                            |
| `name`                                                                                 | *string*                                                                               | :heavy_minus_sign:                                                                     | N/A                                                                                    |                                                                                        |
| `type`                                                                                 | [components.CheckoutEntityType](../../models/components/checkoutentitytype.md)         | :heavy_minus_sign:                                                                     | N/A                                                                                    |                                                                                        |
| `amount`                                                                               | *number*                                                                               | :heavy_minus_sign:                                                                     | N/A                                                                                    |                                                                                        |
| `duration`                                                                             | [components.CheckoutEntityDuration](../../models/components/checkoutentityduration.md) | :heavy_minus_sign:                                                                     | N/A                                                                                    |                                                                                        |
| `durationInMonths`                                                                     | *number*                                                                               | :heavy_minus_sign:                                                                     | N/A                                                                                    |                                                                                        |