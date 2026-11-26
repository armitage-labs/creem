# UpdateProductRequest

## Example Usage

```typescript
import { UpdateProductRequest } from "creem/models/operations";

let value: UpdateProductRequest = {
  id: "<id>",
  updateProductRequestEntity: {
    externalId: "pro-monthly",
    metadata: {
      "plan": "pro",
    },
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
        externalId: "welcome-note",
        type: "custom",
        description: "Private note",
        privateNote: "Thanks for your purchase! Your access code is XYZ123.",
      },
    ],
    customFields: [
      {
        type: "text",
        key: "companyName",
        label: "Company Name",
        text: {
          maxLength: 200,
          minLength: 1,
        },
        checkbox: {
          label:
            "I agree to the [terms and conditions](https://example.com/terms)",
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