# RefundReason

Reason for the refund.

## Example Usage

```typescript
import { RefundReason } from "creem/models/components";

let value: RefundReason = "requested_by_customer";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"duplicate" | "fraudulent" | "requested_by_customer" | "other" | Unrecognized<string>
```