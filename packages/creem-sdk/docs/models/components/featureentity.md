# FeatureEntity

## Example Usage

```typescript
import { FeatureEntity } from "creem/models/components";

let value: FeatureEntity = {
  id: "feat_abc123",
  type: "licenseKey",
  description: "Access to premium course materials.",
};
```

## Fields

| Field                                                                                                       | Type                                                                                                        | Required                                                                                                    | Description                                                                                                 | Example                                                                                                     |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                        | *string*                                                                                                    | :heavy_check_mark:                                                                                          | Unique identifier for the feature.                                                                          | feat_abc123                                                                                                 |
| `type`                                                                                                      | [components.ProductFeatureType](../../models/components/productfeaturetype.md)                              | :heavy_check_mark:                                                                                          | The type of the feature: privateNote (custom note), file (downloadable files), or licenseKey (license key). |                                                                                                             |
| `description`                                                                                               | *string*                                                                                                    | :heavy_check_mark:                                                                                          | A brief description of the feature.                                                                         | Access to premium course materials.                                                                         |