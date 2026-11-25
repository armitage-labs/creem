# LicenseKeyExpiryEntity

How long a license key stays valid after it is issued. `null` for keys that never expire. Each key keeps the expiry it was issued with, so a change applies only to keys issued later.

## Example Usage

```typescript
import { LicenseKeyExpiryEntity } from "creem/models/components";

let value: LicenseKeyExpiryEntity = {
  interval: "month",
  intervalCount: 1,
};
```

## Fields

| Field                                                                                      | Type                                                                                       | Required                                                                                   | Description                                                                                | Example                                                                                    |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `interval`                                                                                 | [components.LicenseKeyExpiryInterval](../../models/components/licensekeyexpiryinterval.md) | :heavy_check_mark:                                                                         | The unit of the license key validity period.                                               |                                                                                            |
| `intervalCount`                                                                            | *number*                                                                                   | :heavy_check_mark:                                                                         | How many `interval`s a license key stays valid after it is issued.                         | 1                                                                                          |