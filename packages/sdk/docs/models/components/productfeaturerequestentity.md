# ProductFeatureRequestEntity

## Example Usage

```typescript
import { ProductFeatureRequestEntity } from "creem/models/components";

let value: ProductFeatureRequestEntity = {
  id: "feat_abc123",
  type: "customerCredits",
  description: "500 image credits",
  customerCredits: {
    amount: "100",
    unitLabel: "tokens",
    bucketName: "images",
  },
};
```

## Fields

| Field                                                                                              | Type                                                                                               | Required                                                                                           | Description                                                                                        | Example                                                                                            |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `id`                                                                                               | *string*                                                                                           | :heavy_minus_sign:                                                                                 | Identifier of an existing feature to edit in place (update only). Omit to add a new feature.       | feat_abc123                                                                                        |
| `type`                                                                                             | [components.ProductFeatureRequestType](../../models/components/productfeaturerequesttype.md)       | :heavy_check_mark:                                                                                 | The feature type. Only `customerCredits` can be managed through the API.                           |                                                                                                    |
| `description`                                                                                      | *string*                                                                                           | :heavy_check_mark:                                                                                 | A brief description of the feature, shown to the customer.                                         | 500 image credits                                                                                  |
| `customerCredits`                                                                                  | [components.CustomerCreditsFeatureEntity](../../models/components/customercreditsfeatureentity.md) | :heavy_check_mark:                                                                                 | The credit grant this feature carries.                                                             |                                                                                                    |