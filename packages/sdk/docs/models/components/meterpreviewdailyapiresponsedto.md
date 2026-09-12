# MeterPreviewDailyApiResponseDto

## Example Usage

```typescript
import { MeterPreviewDailyApiResponseDto } from "creem/models/components";

let value: MeterPreviewDailyApiResponseDto = {
  date: "2026-08-16",
  eventCount: 42,
  value: "1280",
};
```

## Fields

| Field                                                                     | Type                                                                      | Required                                                                  | Description                                                               | Example                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `date`                                                                    | *string*                                                                  | :heavy_check_mark:                                                        | UTC calendar day                                                          | 2026-08-16                                                                |
| `eventCount`                                                              | *number*                                                                  | :heavy_check_mark:                                                        | Matching events on this day                                               | 42                                                                        |
| `value`                                                                   | *string*                                                                  | :heavy_check_mark:                                                        | The aggregation folded over this day alone, as a string for BigInt safety | 1280                                                                      |