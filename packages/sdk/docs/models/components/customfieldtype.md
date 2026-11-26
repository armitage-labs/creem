# CustomFieldType

The type of the field.

## Example Usage

```typescript
import { CustomFieldType } from "creem/models/components";

let value: CustomFieldType = "text";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"text" | "checkbox" | Unrecognized<string>
```