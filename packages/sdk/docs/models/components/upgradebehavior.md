# UpgradeBehavior

How a switch between the products is billed, or `null` for the default.

## Example Usage

```typescript
import { UpgradeBehavior } from "creem/models/components";

let value: UpgradeBehavior = "proration-charge";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"proration-charge-immediately" | "proration-charge" | "proration-none" | Unrecognized<string>
```