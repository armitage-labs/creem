# Duration

The duration type for the discount.

## Example Usage

```typescript
import { Duration } from "creem/models/components";

let value: Duration = "repeating";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"forever" | "once" | "repeating" | Unrecognized<string>
```