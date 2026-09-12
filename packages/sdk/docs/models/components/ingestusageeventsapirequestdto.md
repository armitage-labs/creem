# IngestUsageEventsApiRequestDto

## Example Usage

```typescript
import { IngestUsageEventsApiRequestDto } from "creem/models/components";

let value: IngestUsageEventsApiRequestDto = {
  events: [],
};
```

## Fields

| Field                                                                                                  | Type                                                                                                   | Required                                                                                               | Description                                                                                            |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `events`                                                                                               | [components.IngestUsageEventApiRequestDto](../../models/components/ingestusageeventapirequestdto.md)[] | :heavy_check_mark:                                                                                     | The batch of usage events to ingest (1–100). The whole batch is validated before anything is written.  |