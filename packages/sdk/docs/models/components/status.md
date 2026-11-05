# Status

Status of the checkout.

## Example Usage

```typescript
import { Status } from "creem/models/components";

let value: Status = "completed";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"pending" | "processing" | "completed" | "expired" | Unrecognized<string>
```