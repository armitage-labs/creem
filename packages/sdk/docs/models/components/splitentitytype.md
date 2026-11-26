# SplitEntityType

What the split applies to: `store` (every payment to the store) or `product` (payments for a specific product).

## Example Usage

```typescript
import { SplitEntityType } from "creem/models/components";

let value: SplitEntityType = "store";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"store" | "product" | Unrecognized<string>
```