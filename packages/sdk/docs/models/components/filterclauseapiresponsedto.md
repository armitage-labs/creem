# FilterClauseApiResponseDto

## Example Usage

```typescript
import { FilterClauseApiResponseDto } from "creem/models/components";

let value: FilterClauseApiResponseDto = {
  property: "tier",
  operator: "equals",
  value: "pro",
};
```

## Fields

| Field                                           | Type                                            | Required                                        | Description                                     | Example                                         |
| ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| `property`                                      | *string*                                        | :heavy_check_mark:                              | Event property tested                           | tier                                            |
| `operator`                                      | *string*                                        | :heavy_check_mark:                              | Comparison operator                             | equals                                          |
| `value`                                         | *components.FilterClauseApiResponseDtoValue*    | :heavy_check_mark:                              | Value compared against, as stored after parsing | pro                                             |