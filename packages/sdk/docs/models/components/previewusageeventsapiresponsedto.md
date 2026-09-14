# PreviewUsageEventsApiResponseDto

## Example Usage

```typescript
import { PreviewUsageEventsApiResponseDto } from "creem/models/components";

let value: PreviewUsageEventsApiResponseDto = {
  valid: false,
  events: [],
};
```

## Fields

| Field                                                                                                            | Type                                                                                                             | Required                                                                                                         | Description                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `valid`                                                                                                          | *boolean*                                                                                                        | :heavy_check_mark:                                                                                               | Whether the batch as submitted would be accepted by POST /v1/events/ingest (ingest validation is all-or-nothing) |
| `events`                                                                                                         | [components.PreviewUsageEventReportApiDto](../../models/components/previewusageeventreportapidto.md)[]           | :heavy_check_mark:                                                                                               | Per-event report, in submission order                                                                            |