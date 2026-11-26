# OrderType

The type of order. This can specify whether it's a regular purchase, subscription, etc.

## Example Usage

```typescript
import { OrderType } from "creem/models/components";

let value: OrderType = "onetime";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"recurring" | "onetime" | Unrecognized<string>
```