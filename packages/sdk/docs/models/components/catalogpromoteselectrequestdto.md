# CatalogPromoteSelectRequestDto

## Example Usage

```typescript
import { CatalogPromoteSelectRequestDto } from "creem/models/components";

let value: CatalogPromoteSelectRequestDto = {};
```

## Fields

| Field                                                                                                                                                         | Type                                                                                                                                                          | Required                                                                                                                                                      | Description                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meters`                                                                                                                                                      | *components.CatalogPromoteSelectRequestDtoMeters*                                                                                                             | :heavy_minus_sign:                                                                                                                                            | `"all"` for every test meter, or a list of test meter ids. Leave it out to promote no meters (a product’s meters are still read to resolve its usage prices). |
| `products`                                                                                                                                                    | *components.CatalogPromoteSelectRequestDtoProducts*                                                                                                           | :heavy_minus_sign:                                                                                                                                            | `"all"` for every test product, or a list of test product ids. Leave it out to promote no products.                                                           |