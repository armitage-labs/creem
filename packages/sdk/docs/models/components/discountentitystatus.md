# DiscountEntityStatus

The status of the discount (e.g., active, inactive).

## Example Usage

```typescript
import { DiscountEntityStatus } from "creem/models/components";

let value: DiscountEntityStatus = "active";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"deleted" | "active" | "draft" | "expired" | "scheduled" | Unrecognized<string>
```