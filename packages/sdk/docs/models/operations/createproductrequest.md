# CreateProductRequest

## Example Usage

```typescript
import { CreateProductRequest } from "creem/models/operations";

let value: CreateProductRequest = {
  createProductRequestEntity: {
    name: "<value>",
    description:
      "ingratiate premier innovate carefully never shyly afterwards hmph phew pfft",
    imageUrl: "https://picsum.photos/200/300",
    imageUrls: [
      "https://picsum.photos/200/300",
      "https://picsum.photos/200/301",
    ],
    price: 400,
    currency: "USD",
    billingType: "onetime",
    recurringIntervalCount: 1,
    businessNetPricing: false,
    payWhatYouWant: false,
    suggestedPrice: 1500,
    trialPeriodDays: 7,
    trialPrice: 100,
    defaultSuccessUrl: "https://example.com/?status=successful",
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

| Field                                                                                                  | Type                                                                                                   | Required                                                                                               | Description                                                                                            |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `idempotencyKey`                                                                                       | *string*                                                                                               | :heavy_minus_sign:                                                                                     | Optional key that makes retries return the originally created product instead of creating a duplicate. |
| `createProductRequestEntity`                                                                           | [components.CreateProductRequestEntity](../../models/components/createproductrequestentity.md)         | :heavy_check_mark:                                                                                     | Product creation payload                                                                               |