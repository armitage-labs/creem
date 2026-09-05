# CreateSplitRequestEntity

## Example Usage

```typescript
import { CreateSplitRequestEntity } from "creem/models/components";

let value: CreateSplitRequestEntity = {
  description: "Q3 revenue share",
  type: "store",
  typeReference: "prod_1a2b3c4d",
  recipients: [],
};
```

## Fields

| Field                                                                                                                        | Type                                                                                                                         | Required                                                                                                                     | Description                                                                                                                  | Example                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `description`                                                                                                                | *string*                                                                                                                     | :heavy_minus_sign:                                                                                                           | An optional human-readable description of the split.                                                                         | Q3 revenue share                                                                                                             |
| `type`                                                                                                                       | [components.CreateSplitRequestEntityType](../../models/components/createsplitrequestentitytype.md)                           | :heavy_check_mark:                                                                                                           | What the split applies to: `store` (every payment to your store) or `product` (payments for one product).                    | store                                                                                                                        |
| `typeReference`                                                                                                              | *string*                                                                                                                     | :heavy_check_mark:                                                                                                           | The id of the entity the split applies to: your store id when `type` is `store`, or the product id when `type` is `product`. | prod_1a2b3c4d                                                                                                                |
| `recipients`                                                                                                                 | [components.CreateSplitRecipientRequestEntity](../../models/components/createsplitrecipientrequestentity.md)[]               | :heavy_check_mark:                                                                                                           | The recipients of the split and their percentage shares. Between 1 and 10 recipients; shares must sum to at most 100.        |                                                                                                                              |