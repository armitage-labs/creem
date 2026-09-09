# ScreenPromptRequest

## Example Usage

```typescript
import { ScreenPromptRequest } from "creem/models/components";

let value: ScreenPromptRequest = {
  prompt: "<value>",
};
```

## Fields

| Field                                                  | Type                                                   | Required                                               | Description                                            |
| ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------ |
| `prompt`                                               | *string*                                               | :heavy_check_mark:                                     | The text prompt to evaluate against content policies.  |
| `externalId`                                           | *string*                                               | :heavy_minus_sign:                                     | An optional identifier to associate this request with. |