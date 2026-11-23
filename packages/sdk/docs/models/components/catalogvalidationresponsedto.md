# CatalogValidationResponseDto

## Example Usage

```typescript
import { CatalogValidationResponseDto } from "creem/models/components";

let value: CatalogValidationResponseDto = {
  object: "<value>",
  valid: true,
  items: [],
};
```

## Fields

| Field                                                                                                        | Type                                                                                                         | Required                                                                                                     | Description                                                                                                  |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `object`                                                                                                     | *string*                                                                                                     | :heavy_check_mark:                                                                                           | Always `catalog_validation`.                                                                                 |
| `valid`                                                                                                      | *boolean*                                                                                                    | :heavy_check_mark:                                                                                           | Whether every item passes. The status is `200` when it is true and `422` otherwise.                          |
| `items`                                                                                                      | [components.CatalogValidationItemResponseDto](../../models/components/catalogvalidationitemresponsedto.md)[] | :heavy_check_mark:                                                                                           | One entry per item, in the order of the request.                                                             |