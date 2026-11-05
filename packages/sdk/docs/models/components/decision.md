# Decision

The moderation decision.

## Example Usage

```typescript
import { Decision } from "creem/models/components";

let value: Decision = "allow";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"allow" | "deny" | "flag" | Unrecognized<string>
```