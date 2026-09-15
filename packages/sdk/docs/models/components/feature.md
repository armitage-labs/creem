# ~~Feature~~

DEPRECATED: Use `license_keys` instead. Features issued for the order.

> :warning: **DEPRECATED**: This will be removed in a future release, please migrate away from it as soon as possible.

## Example Usage

```typescript
import { Feature } from "creem/models/components";

let value: Feature = {
  id: "feat_abc123",
  description: "Get access to the full course materials.",
  privateNote: "Thank you for your purchase! Here is your access code: XYZ123",
  file: {
    files: [],
  },
  licenseKey: {
    id: "<id>",
    mode: "test",
    object: "<value>",
    productId: "prod_abc123",
    status: "active",
    key: "ABC123-XYZ456-XYZ456-XYZ456",
    activation: 5,
    activationLimit: 1,
    expiresAt: new Date("2023-09-13T00:00:00Z"),
    createdAt: new Date("2023-09-13T00:00:00Z"),
    instance: {
      id: "<id>",
      mode: "test",
      object: "license-instance",
      name: "My Customer License Instance",
      status: "active",
      createdAt: new Date("2023-09-13T00:00:00Z"),
    },
  },
  customerCredits: {
    amount: "100",
    unitLabel: "tokens",
    bucketName: "images",
  },
};
```

## Fields

| Field                                                                                                                                                                                             | Type                                                                                                                                                                                              | Required                                                                                                                                                                                          | Description                                                                                                                                                                                       | Example                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                                                                                              | *string*                                                                                                                                                                                          | :heavy_minus_sign:                                                                                                                                                                                | Unique identifier for the feature.                                                                                                                                                                | feat_abc123                                                                                                                                                                                       |
| `description`                                                                                                                                                                                     | *string*                                                                                                                                                                                          | :heavy_minus_sign:                                                                                                                                                                                | A brief description of the feature.                                                                                                                                                               | Get access to the full course materials.                                                                                                                                                          |
| `type`                                                                                                                                                                                            | [components.ProductFeatureType](../../models/components/productfeaturetype.md)                                                                                                                    | :heavy_minus_sign:                                                                                                                                                                                | The type of the feature: `custom` (private note), `file` (downloadable files), `licenseKey` (license key), or `customerCredits` (customer credit grant).                                          |                                                                                                                                                                                                   |
| `privateNote`                                                                                                                                                                                     | *string*                                                                                                                                                                                          | :heavy_minus_sign:                                                                                                                                                                                | Private note from the seller. This is only visible to the customer after purchase.                                                                                                                | Thank you for your purchase! Here is your access code: XYZ123                                                                                                                                     |
| `file`                                                                                                                                                                                            | [components.FileT](../../models/components/filet.md)                                                                                                                                              | :heavy_minus_sign:                                                                                                                                                                                | File feature data containing downloadable files.                                                                                                                                                  |                                                                                                                                                                                                   |
| `licenseKey`                                                                                                                                                                                      | [components.LicenseKey](../../models/components/licensekey.md)                                                                                                                                    | :heavy_minus_sign:                                                                                                                                                                                | License key issued for the order.                                                                                                                                                                 |                                                                                                                                                                                                   |
| `customerCredits`                                                                                                                                                                                 | [components.CustomerCredits](../../models/components/customercredits.md)                                                                                                                          | :heavy_minus_sign:                                                                                                                                                                                | Customer credits feature data.                                                                                                                                                                    |                                                                                                                                                                                                   |
| ~~`license`~~                                                                                                                                                                                     | [components.License](../../models/components/license.md)                                                                                                                                          | :heavy_minus_sign:                                                                                                                                                                                | : warning: ** DEPRECATED **: This will be removed in a future release, please migrate away from it as soon as possible.<br/><br/>DEPRECATED: Use `license_key` instead. License key issued for the order. |                                                                                                                                                                                                   |