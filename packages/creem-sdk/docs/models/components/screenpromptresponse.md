# ScreenPromptResponse

## Example Usage

```typescript
import { ScreenPromptResponse } from "creem/models/components";

let value: ScreenPromptResponse = {
  id: "<id>",
  object: "moderation_result",
  prompt: "<value>",
  decision: "flag",
  usage: {
    units: 4313.42,
  },
};
```

## Fields

| Field                                                            | Type                                                             | Required                                                         | Description                                                      | Example                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| `id`                                                             | *string*                                                         | :heavy_check_mark:                                               | Unique identifier for the moderation result.                     |                                                                  |
| `object`                                                         | *string*                                                         | :heavy_check_mark:                                               | Object type.                                                     | moderation_result                                                |
| `prompt`                                                         | *string*                                                         | :heavy_check_mark:                                               | The prompt that was screened.                                    |                                                                  |
| `externalId`                                                     | *string*                                                         | :heavy_minus_sign:                                               | The external identifier provided in the request.                 |                                                                  |
| `decision`                                                       | [components.Decision](../../models/components/decision.md)       | :heavy_check_mark:                                               | The moderation decision.                                         |                                                                  |
| `usage`                                                          | [components.UsageEntity](../../models/components/usageentity.md) | :heavy_check_mark:                                               | Usage information for this call.                                 |                                                                  |