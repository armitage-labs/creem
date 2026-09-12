# MeterListApiResponseDto

## Example Usage

```typescript
import { MeterListApiResponseDto } from "creem/models/components";

let value: MeterListApiResponseDto = {
  object: "list",
  data: [],
  hasMore: true,
};
```

## Fields

| Field                                                                              | Type                                                                               | Required                                                                           | Description                                                                        | Example                                                                            |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `object`                                                                           | *string*                                                                           | :heavy_check_mark:                                                                 | Object type                                                                        | list                                                                               |
| `data`                                                                             | [components.MeterApiResponseDto](../../models/components/meterapiresponsedto.md)[] | :heavy_check_mark:                                                                 | Array of meters                                                                    |                                                                                    |
| `hasMore`                                                                          | *boolean*                                                                          | :heavy_check_mark:                                                                 | Whether more items exist beyond this page                                          |                                                                                    |