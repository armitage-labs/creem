# OrderStatus

Current status of the order.

## Example Usage

```typescript
import { OrderStatus } from "creem/models/components";

let value: OrderStatus = "paid";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"pending" | "paid" | Unrecognized<string>
```