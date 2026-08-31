# Text

Configuration for text field type.

## Example Usage

```typescript
import { Text } from "creem/models/components";

let value: Text = {};
```

## Fields

| Field                                               | Type                                                | Required                                            | Description                                         |
| --------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| `maxLength`                                         | *number*                                            | :heavy_minus_sign:                                  | Maximum character length constraint for the input.  |
| `minimumLength`                                     | *number*                                            | :heavy_minus_sign:                                  | Minimum character length requirement for the input. |
| `value`                                             | *string*                                            | :heavy_minus_sign:                                  | The value of the input.                             |