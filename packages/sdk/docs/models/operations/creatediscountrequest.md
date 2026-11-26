# CreateDiscountRequest

## Example Usage

```typescript
import { CreateDiscountRequest } from "creem/models/operations";

let value: CreateDiscountRequest = {
  createDiscountRequestEntity: {
    name: "Holiday Sale",
    code: "HOLIDAY2024",
    type: "fixed",
    amount: 20,
    currency: "USD",
    percentage: 15,
    expiryDate: new Date("2024-12-31T23:59:59Z"),
    maxRedemptions: 100,
    duration: "forever",
    durationInMonths: 6,
    appliesToProducts: [
      "prod_123",
      "prod_456",
    ],
    appliesToProductExternalIds: [
      "pro-monthly",
    ],
    externalId: "spring-2026",
  },
};
```

## Fields

| Field                                                                                                                                                                                                                                                                                    | Type                                                                                                                                                                                                                                                                                     | Required                                                                                                                                                                                                                                                                                 | Description                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idempotencyKey`                                                                                                                                                                                                                                                                         | *string*                                                                                                                                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                                                                                                                                       | Optional key that makes retries return the originally created discount instead of creating a duplicate. Reusing a key with a different body returns the first result, and a key lasts 24 hours. After a failed create whose outcome is unclear, the key answers 429 for up to 5 minutes. |
| `createDiscountRequestEntity`                                                                                                                                                                                                                                                            | [components.CreateDiscountRequestEntity](../../models/components/creatediscountrequestentity.md)                                                                                                                                                                                         | :heavy_check_mark:                                                                                                                                                                                                                                                                       | Discount creation payload                                                                                                                                                                                                                                                                |