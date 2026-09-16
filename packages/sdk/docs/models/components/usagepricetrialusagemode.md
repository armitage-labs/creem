# UsagePriceTrialUsageMode

Usage metered during a free trial: `free` is not charged, `accrue` is charged when the trial converts. Defaults to `free`.

## Example Usage

```typescript
import { UsagePriceTrialUsageMode } from "creem/models/components";

let value: UsagePriceTrialUsageMode = "accrue";
```

## Values

```typescript
"free" | "accrue"
```