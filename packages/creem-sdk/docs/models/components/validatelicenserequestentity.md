# ValidateLicenseRequestEntity

## Example Usage

```typescript
import { ValidateLicenseRequestEntity } from "creem/models/components";

let value: ValidateLicenseRequestEntity = {
  key: "<key>",
  instanceId: "<id>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `key`                           | *string*                        | :heavy_check_mark:              | The license key to validate.    |
| `instanceId`                    | *string*                        | :heavy_check_mark:              | Id of the instance to validate. |