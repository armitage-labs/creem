# MeterFilterApiResponseDto

## Example Usage

```typescript
import { MeterFilterApiResponseDto } from "creem/models/components";

let value: MeterFilterApiResponseDto = {
  conjunction: "and",
  clauses: [],
};
```

## Fields

| Field                                                                                                              | Type                                                                                                               | Required                                                                                                           | Description                                                                                                        | Example                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `conjunction`                                                                                                      | [components.MeterFilterApiResponseDtoConjunction](../../models/components/meterfilterapiresponsedtoconjunction.md) | :heavy_check_mark:                                                                                                 | How the clauses combine                                                                                            | and                                                                                                                |
| `clauses`                                                                                                          | [components.FilterClauseApiResponseDto](../../models/components/filterclauseapiresponsedto.md)[]                   | :heavy_check_mark:                                                                                                 | Filter clauses; empty means the meter counts every event                                                           |                                                                                                                    |