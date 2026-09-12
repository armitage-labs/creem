# MeterPreviewApiResponseDto

## Example Usage

```typescript
import { MeterPreviewApiResponseDto } from "creem/models/components";

let value: MeterPreviewApiResponseDto = {
  matchedEvents: 137,
  units: "4820",
  distinctCustomers: 12,
  daily: [
    {
      date: "2026-08-16",
      eventCount: 42,
      value: "1280",
    },
  ],
};
```

## Fields

| Field                                                                                                      | Type                                                                                                       | Required                                                                                                   | Description                                                                                                | Example                                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `matchedEvents`                                                                                            | *number*                                                                                                   | :heavy_check_mark:                                                                                         | Events the meter would count over the preview window                                                       | 137                                                                                                        |
| `units`                                                                                                    | *string*                                                                                                   | :heavy_check_mark:                                                                                         | Aggregated units over the whole window, as a string for BigInt safety                                      | 4820                                                                                                       |
| `distinctCustomers`                                                                                        | *number*                                                                                                   | :heavy_check_mark:                                                                                         | Distinct customers among the matching events                                                               | 12                                                                                                         |
| `daily`                                                                                                    | [components.MeterPreviewDailyApiResponseDto](../../models/components/meterpreviewdailyapiresponsedto.md)[] | :heavy_check_mark:                                                                                         | The last 7 UTC days (today included), oldest first and zero-filled                                         |                                                                                                            |