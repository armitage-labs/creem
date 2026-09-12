# MeterFilterApiRequestDto

## Example Usage

```typescript
import { MeterFilterApiRequestDto } from "creem/models/components";

let value: MeterFilterApiRequestDto = {
  conjunction: "and",
  clauses: [],
};
```

## Fields

| Field                                                                                          | Type                                                                                           | Required                                                                                       | Description                                                                                    | Example                                                                                        |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `conjunction`                                                                                  | [components.Conjunction](../../models/components/conjunction.md)                               | :heavy_check_mark:                                                                             | How the clauses combine                                                                        | and                                                                                            |
| `clauses`                                                                                      | [components.FilterClauseApiRequestDto](../../models/components/filterclauseapirequestdto.md)[] | :heavy_check_mark:                                                                             | Filter clauses. An empty list means the meter counts every event with the given event name.    |                                                                                                |