# ProductFileFeatureFilesRequestEntity

## Example Usage

```typescript
import { ProductFileFeatureFilesRequestEntity } from "creem/models/components";

let value: ProductFileFeatureFilesRequestEntity = {
  files: [
    {
      id: "file_4dGTkmBdnTnU9vV3KZ2Hcz",
      fileName: "ebook.pdf",
      type: "application/pdf",
      size: 1024000,
    },
  ],
};
```

## Fields

| Field                                                                                                                                                                                                 | Type                                                                                                                                                                                                  | Required                                                                                                                                                                                              | Description                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `files`                                                                                                                                                                                               | [components.ProductFeatureFileRequestEntity](../../models/components/productfeaturefilerequestentity.md)[]                                                                                            | :heavy_check_mark:                                                                                                                                                                                    | The files buyers can download after purchase. The array is the complete set of files of the feature, each file once. It needs at least one file, unless it sends back a stored feature that has none. |