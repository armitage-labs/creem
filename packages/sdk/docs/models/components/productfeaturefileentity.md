# ProductFeatureFileEntity

## Example Usage

```typescript
import { ProductFeatureFileEntity } from "creem/models/components";

let value: ProductFeatureFileEntity = {
  id: "file_4dGTkmBdnTnU9vV3KZ2Hcz",
  fileName: "ebook.pdf",
  type: "application/pdf",
  size: 1024000,
};
```

## Fields

| Field                                    | Type                                     | Required                                 | Description                              | Example                                  |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| `id`                                     | *string*                                 | :heavy_check_mark:                       | Unique identifier for the file.          | file_4dGTkmBdnTnU9vV3KZ2Hcz              |
| `fileName`                               | *string*                                 | :heavy_check_mark:                       | The name buyers download the file under. | ebook.pdf                                |
| `type`                                   | *string*                                 | :heavy_check_mark:                       | The MIME type of the file.               | application/pdf                          |
| `size`                                   | *number*                                 | :heavy_check_mark:                       | The size of the file in bytes.           | 1024000                                  |