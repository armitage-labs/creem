# CatalogPromoteResponseDto

## Example Usage

```typescript
import { CatalogPromoteResponseDto } from "creem/models/components";

let value: CatalogPromoteResponseDto = {
  runId: "<id>",
  dryRun: true,
  summary: {
    created: 253764,
    updated: 289912,
    unchanged: 465210,
    needsKey: 948639,
    conflict: 816528,
    failed: 429590,
    blocked: 426168,
    notWritten: 638637,
  },
  items: [],
  validation: {
    scope: "<value>",
    batches: 764466,
    checkedBatches: 239055,
    passed: true,
    written: false,
  },
  nextCursor: "<value>",
};
```

## Fields

| Field                                                                                                                                                                   | Type                                                                                                                                                                    | Required                                                                                                                                                                | Description                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runId`                                                                                                                                                                 | *string*                                                                                                                                                                | :heavy_check_mark:                                                                                                                                                      | The run (`cprun_…`), the same on every page of it.                                                                                                                      |
| `dryRun`                                                                                                                                                                | *boolean*                                                                                                                                                               | :heavy_check_mark:                                                                                                                                                      | `true` on a dry run: nothing was written.                                                                                                                               |
| `summary`                                                                                                                                                               | [components.CatalogPromoteSummaryResponseDto](../../models/components/catalogpromotesummaryresponsedto.md)                                                              | :heavy_check_mark:                                                                                                                                                      | One count per result for this page’s items; every result always present.                                                                                                |
| `items`                                                                                                                                                                 | [components.CatalogPromoteItemResponseDto](../../models/components/catalogpromoteitemresponsedto.md)[]                                                                  | :heavy_check_mark:                                                                                                                                                      | This page’s items: meters, then products, then the meters test archived, each in test id order. Every item comes once per run. Empty on a page that only ran the check. |
| `validation`                                                                                                                                                            | [components.CatalogPromoteValidationResponseDto](../../models/components/catalogpromotevalidationresponsedto.md)                                                        | :heavy_check_mark:                                                                                                                                                      | On the real run’s first page: how its writes were checked before the first one. Null otherwise.                                                                         |
| `nextCursor`                                                                                                                                                            | *string*                                                                                                                                                                | :heavy_check_mark:                                                                                                                                                      | Send it as `cursor` with the same `select` and `dry_run` to go on; null when the run is complete.                                                                       |