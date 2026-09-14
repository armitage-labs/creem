# PreviewUsageEventWarningApiDto

## Example Usage

```typescript
import { PreviewUsageEventWarningApiDto } from "creem/models/components";

let value: PreviewUsageEventWarningApiDto = {
  code: "no_matching_meter",
  message: "<value>",
};
```

## Fields

| Field                                                                                                          | Type                                                                                                           | Required                                                                                                       | Description                                                                                                    | Example                                                                                                        |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `code`                                                                                                         | [components.PreviewUsageEventWarningApiDtoCode](../../models/components/previewusageeventwarningapidtocode.md) | :heavy_check_mark:                                                                                             | Warning code — same set as ingest warnings                                                                     | no_matching_meter                                                                                              |
| `message`                                                                                                      | *string*                                                                                                       | :heavy_check_mark:                                                                                             | Human-readable explanation                                                                                     |                                                                                                                |