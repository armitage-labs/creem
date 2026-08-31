# TextFieldConfig

## Example Usage

```typescript
import { TextFieldConfig } from "creem/models/components";

let value: TextFieldConfig = {
  maxLength: 200,
  minLength: 1,
};
```

## Fields

| Field                                               | Type                                                | Required                                            | Description                                         | Example                                             |
| --------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| `maxLength`                                         | *number*                                            | :heavy_minus_sign:                                  | Maximum character length constraint for the input.  | 200                                                 |
| `minLength`                                         | *number*                                            | :heavy_minus_sign:                                  | Minimum character length requirement for the input. | 1                                                   |