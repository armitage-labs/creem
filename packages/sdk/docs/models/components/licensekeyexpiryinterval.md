# LicenseKeyExpiryInterval

The unit of the license key validity period.

## Example Usage

```typescript
import { LicenseKeyExpiryInterval } from "creem/models/components";

let value: LicenseKeyExpiryInterval = "month";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"day" | "month" | "year" | Unrecognized<string>
```