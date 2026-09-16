# UpdateProductRequest

## Example Usage

```typescript
import { UpdateProductRequest } from "creem/models/operations";

let value: UpdateProductRequest = {
  id: "<id>",
  updateProductRequestEntity: {
    businessNetPricing: false,
    trialPeriodDays: 7,
    trialPrice: 100,
    usagePrices: [
      {
        id: "price_abc123",
        meterId: "mtr_abc123",
        unitPrice: 0.002,
        freeAllowance: 1000,
        cap: 50000,
        settlementMode: "prepaid",
        targetAccountName: "images",
      },
    ],
    features: [
      {
        id: "feat_abc123",
        type: "customerCredits",
        description: "500 image credits",
        customerCredits: {
          amount: "100",
          unitLabel: "tokens",
          bucketName: "images",
        },
      },
    ],
  },
};
```

## Fields

| Field                                                                                          | Type                                                                                           | Required                                                                                       | Description                                                                                    |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `id`                                                                                           | *string*                                                                                       | :heavy_check_mark:                                                                             | The product ID                                                                                 |
| `updateProductRequestEntity`                                                                   | [components.UpdateProductRequestEntity](../../models/components/updateproductrequestentity.md) | :heavy_check_mark:                                                                             | Product update payload                                                                         |