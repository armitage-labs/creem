# CommissionStatus

The settlement status of the commission. `pending` while on hold, `approved` once cleared and available, `paid` once settled by a payout.

## Example Usage

```typescript
import { CommissionStatus } from "creem/models/components";

let value: CommissionStatus = "paid";
```

## Values

```typescript
"pending" | "approved" | "paid"
```