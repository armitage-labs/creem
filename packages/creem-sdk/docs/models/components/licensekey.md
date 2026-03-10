# LicenseKey

License key issued for the order.

## Example Usage

```typescript
import { LicenseKey } from "creem/models/components";

let value: LicenseKey = {
  id: "<id>",
  mode: "sandbox",
  object: "<value>",
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
};
```

## Fields

| Field                                                                                                                  | Type                                                                                                                   | Required                                                                                                               | Description                                                                                                            | Example                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                   | *string*                                                                                                               | :heavy_check_mark:                                                                                                     | Unique identifier for the object.                                                                                      |                                                                                                                        |
| `mode`                                                                                                                 | [components.EnvironmentMode](../../models/components/environmentmode.md)                                               | :heavy_check_mark:                                                                                                     | String representing the environment.                                                                                   |                                                                                                                        |
| `object`                                                                                                               | *string*                                                                                                               | :heavy_check_mark:                                                                                                     | A string representing the object’s type. Objects of the same type share the same value.                                |                                                                                                                        |
| `status`                                                                                                               | [components.LicenseStatus](../../models/components/licensestatus.md)                                                   | :heavy_check_mark:                                                                                                     | The current status of the license key.                                                                                 |                                                                                                                        |
| `key`                                                                                                                  | *string*                                                                                                               | :heavy_check_mark:                                                                                                     | The license key.                                                                                                       | ABC123-XYZ456-XYZ456-XYZ456                                                                                            |
| `activation`                                                                                                           | *number*                                                                                                               | :heavy_check_mark:                                                                                                     | The number of instances that this license key was activated.                                                           | 5                                                                                                                      |
| `activationLimit`                                                                                                      | *number*                                                                                                               | :heavy_minus_sign:                                                                                                     | The activation limit. Null if activations are unlimited.                                                               | 1                                                                                                                      |
| `expiresAt`                                                                                                            | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)                          | :heavy_minus_sign:                                                                                                     | The date the license key expires. Null if it does not have an expiration date.                                         | 2023-09-13T00:00:00Z                                                                                                   |
| `createdAt`                                                                                                            | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)                          | :heavy_check_mark:                                                                                                     | The creation date of the license key.                                                                                  | 2023-09-13T00:00:00Z                                                                                                   |
| `instance`                                                                                                             | [components.ProductFeatureEntityLicenseKeyInstance](../../models/components/productfeatureentitylicensekeyinstance.md) | :heavy_minus_sign:                                                                                                     | Associated license instances.                                                                                          |                                                                                                                        |