# RecipientType

The kind of recipient: `store` for an existing store (add it directly), or `email` to invite someone by email (the split stays disabled until they accept).

## Example Usage

```typescript
import { RecipientType } from "creem/models/components";

let value: RecipientType = "store";
```

## Values

```typescript
"store" | "email"
```