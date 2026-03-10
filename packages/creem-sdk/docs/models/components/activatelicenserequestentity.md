# ActivateLicenseRequestEntity

## Example Usage

```typescript
import { ActivateLicenseRequestEntity } from "creem/models/components";

let value: ActivateLicenseRequestEntity = {
  key: "<key>",
  instanceName: "<value>",
};
```

## Fields

| Field                                                 | Type                                                  | Required                                              | Description                                           |
| ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| `key`                                                 | *string*                                              | :heavy_check_mark:                                    | The license key to activate.                          |
| `instanceName`                                        | *string*                                              | :heavy_check_mark:                                    | A label for the new instance to identify it in Creem. |