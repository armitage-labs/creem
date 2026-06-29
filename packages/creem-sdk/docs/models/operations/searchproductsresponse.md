# SearchProductsResponse

## Example Usage

```typescript
import { SearchProductsResponse } from "creem/models/operations";

let value: SearchProductsResponse = {
  result: {
    items: [
      {
        id: "<id>",
        mode: "test",
        object: "<value>",
        name: "<value>",
        description: "This is a sample product description.",
        imageUrl: "https://example.com/image.jpg",
        features: [
          {
            id: "feat_abc123",
            type: "licenseKey",
            description: "Access to premium course materials.",
          },
        ],
        price: 400,
        currency: "USD",
        billingType: "onetime",
        billingPeriod: "once",
        status: "archived",
        taxMode: "exclusive",
        taxCategory: "digital-goods-service",
        productUrl: "https://creem.io/product/prod_123123123123",
        defaultSuccessUrl: "https://example.com/?status=successful",
        createdAt: new Date("2023-01-01T00:00:00Z"),
        updatedAt: new Date("2023-01-01T00:00:00Z"),
      },
    ],
    pagination: {
      totalRecords: 0,
      totalPages: 0,
      currentPage: 1,
      nextPage: 2,
      prevPage: null,
    },
  },
};
```

## Fields

| Field                                                                        | Type                                                                         | Required                                                                     | Description                                                                  |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `result`                                                                     | [components.ProductListEntity](../../models/components/productlistentity.md) | :heavy_check_mark:                                                           | N/A                                                                          |