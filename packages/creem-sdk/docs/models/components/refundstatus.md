# RefundStatus

Status of the refund. `pending` and `requiresAction` represent non-terminal provider processing states.

## Example Usage

```typescript
import { RefundStatus } from "creem/models/components";

let value: RefundStatus = "pending";
```

## Values

```typescript
"pending" | "requiresAction" | "succeeded" | "failed" | "canceled"
```