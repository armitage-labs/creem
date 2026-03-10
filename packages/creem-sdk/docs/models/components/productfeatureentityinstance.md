# ProductFeatureEntityInstance

Associated license instances.

## Example Usage

```typescript
import { ProductFeatureEntityInstance } from "creem/models/components";

let value: ProductFeatureEntityInstance = {
  id: "<id>",
  mode: "prod",
  object: "license-instance",
  name: "My Customer License Instance",
  status: "active",
  createdAt: new Date("2023-09-13T00:00:00Z"),
};
```

## Fields

| Field                                                                                                        | Type                                                                                                         | Required                                                                                                     | Description                                                                                                  | Example                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                         | *string*                                                                                                     | :heavy_check_mark:                                                                                           | Unique identifier for the object.                                                                            |                                                                                                              |
| `mode`                                                                                                       | [components.EnvironmentMode](../../models/components/environmentmode.md)                                     | :heavy_check_mark:                                                                                           | String representing the environment.                                                                         |                                                                                                              |
| `object`                                                                                                     | *string*                                                                                                     | :heavy_check_mark:                                                                                           | A string representing the object’s type. Objects of the same type share the same value.                      | license-instance                                                                                             |
| `name`                                                                                                       | *string*                                                                                                     | :heavy_check_mark:                                                                                           | The name of the license instance.                                                                            | My Customer License Instance                                                                                 |
| `status`                                                                                                     | [components.ProductFeatureEntityLicenseStatus](../../models/components/productfeatureentitylicensestatus.md) | :heavy_check_mark:                                                                                           | The status of the license instance.                                                                          | active                                                                                                       |
| `createdAt`                                                                                                  | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)                | :heavy_check_mark:                                                                                           | The creation date of the license instance.                                                                   | 2023-09-13T00:00:00Z                                                                                         |