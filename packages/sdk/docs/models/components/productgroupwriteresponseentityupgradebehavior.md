# ProductGroupWriteResponseEntityUpgradeBehavior

How a switch between the products is billed, or `null` for the default.

## Example Usage

```typescript
import { ProductGroupWriteResponseEntityUpgradeBehavior } from "creem/models/components";

let value: ProductGroupWriteResponseEntityUpgradeBehavior =
  "proration-charge-immediately";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"proration-charge-immediately" | "proration-charge" | "proration-none" | Unrecognized<string>
```