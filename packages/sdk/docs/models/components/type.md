# Type

The type of the discount, either "percentage" or "fixed".

## Example Usage

```typescript
import { Type } from "creem/models/components";

let value: Type = "percentage";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"percentage" | "fixed" | Unrecognized<string>
```