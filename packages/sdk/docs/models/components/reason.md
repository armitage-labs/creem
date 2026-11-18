# Reason

With a revoke or revoke_credit only: why the account, or that order’s credit, must go.

## Example Usage

```typescript
import { Reason } from "creem/models/components";

let value: Reason = "test";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"refund" | "chargeback" | "undelivered" | "test" | Unrecognized<string>
```