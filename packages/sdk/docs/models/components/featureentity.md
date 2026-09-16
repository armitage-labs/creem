# FeatureEntity

## Example Usage

```typescript
import { FeatureEntity } from "creem/models/components";

let value: FeatureEntity = {
  id: "feat_abc123",
  type: "customerCredits",
  description: "Access to premium course materials.",
  customerCredits: {
    amount: "100",
    unitLabel: "tokens",
    bucketName: "images",
  },
};
```

## Fields

| Field                                                                                                                                                    | Type                                                                                                                                                     | Required                                                                                                                                                 | Description                                                                                                                                              | Example                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                                                     | *string*                                                                                                                                                 | :heavy_check_mark:                                                                                                                                       | Unique identifier for the feature.                                                                                                                       | feat_abc123                                                                                                                                              |
| `type`                                                                                                                                                   | [components.ProductFeatureType](../../models/components/productfeaturetype.md)                                                                           | :heavy_check_mark:                                                                                                                                       | The type of the feature: `custom` (private note), `file` (downloadable files), `licenseKey` (license key), or `customerCredits` (customer credit grant). |                                                                                                                                                          |
| `description`                                                                                                                                            | *string*                                                                                                                                                 | :heavy_check_mark:                                                                                                                                       | A brief description of the feature.                                                                                                                      | Access to premium course materials.                                                                                                                      |
| `customerCredits`                                                                                                                                        | [components.CustomerCredits](../../models/components/customercredits.md)                                                                                 | :heavy_minus_sign:                                                                                                                                       | The credit grant behind a `customerCredits` feature. Absent for other feature types.                                                                     |                                                                                                                                                          |