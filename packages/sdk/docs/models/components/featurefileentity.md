# FeatureFileEntity

## Example Usage

```typescript
import { FeatureFileEntity } from "creem/models/components";

let value: FeatureFileEntity = {
  id: "file_abc123",
  fileName: "ebook.pdf",
  url: "https://storage.creem.io/files/ebook.pdf",
  type: "application/pdf",
  size: 1024000,
};
```

## Fields

| Field                                    | Type                                     | Required                                 | Description                              | Example                                  |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| `id`                                     | *string*                                 | :heavy_check_mark:                       | Unique identifier for the file.          | file_abc123                              |
| `fileName`                               | *string*                                 | :heavy_check_mark:                       | The name of the file.                    | ebook.pdf                                |
| `url`                                    | *string*                                 | :heavy_check_mark:                       | The URL to download the file.            | https://storage.creem.io/files/ebook.pdf |
| `type`                                   | *string*                                 | :heavy_check_mark:                       | The MIME type of the file.               | application/pdf                          |
| `size`                                   | *number*                                 | :heavy_check_mark:                       | The size of the file in bytes.           | 1024000                                  |