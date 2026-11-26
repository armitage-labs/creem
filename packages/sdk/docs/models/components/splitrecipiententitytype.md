# SplitRecipientEntityType

How the share is calculated. Currently always `percentage` — the recipient receives `amount` percent of the split net.

## Example Usage

```typescript
import { SplitRecipientEntityType } from "creem/models/components";

let value: SplitRecipientEntityType = "percentage";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"fixed" | "percentage" | Unrecognized<string>
```