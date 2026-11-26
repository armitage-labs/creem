# SplitRecipientEntityRecipientType

The kind of recipient. `store` and `user` are resolved (active) recipients; `email` is an invitee who has not yet accepted (the split share is held until they do).

## Example Usage

```typescript
import { SplitRecipientEntityRecipientType } from "creem/models/components";

let value: SplitRecipientEntityRecipientType = "store";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"store" | "user" | "email" | Unrecognized<string>
```