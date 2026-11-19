# UpdateDiscountRequest

## Example Usage

```typescript
import { UpdateDiscountRequest } from "creem/models/operations";

let value: UpdateDiscountRequest = {
  id: "<id>",
  updateDiscountRequestEntity: {
    name: "Summer Sale",
    amount: 2000,
    percentage: 15,
    currency: "USD",
    expiryDate: new Date("2026-12-31T23:59:59Z"),
    maxRedemptions: 100,
    durationInMonths: 6,
    appliesToProducts: [
      "prod_123",
    ],
    appliesToProductExternalIds: [
      "pro-monthly",
    ],
    externalId: "spring-2026",
  },
};
```

## Fields

| Field                                                                                            | Type                                                                                             | Required                                                                                         | Description                                                                                      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `id`                                                                                             | *string*                                                                                         | :heavy_check_mark:                                                                               | The discount ID                                                                                  |
| `updateDiscountRequestEntity`                                                                    | [components.UpdateDiscountRequestEntity](../../models/components/updatediscountrequestentity.md) | :heavy_check_mark:                                                                               | Discount update payload                                                                          |