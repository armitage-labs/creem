# PaginationEntity

## Example Usage

```typescript
import { PaginationEntity } from "creem/models/components";

let value: PaginationEntity = {
  totalRecords: 0,
  totalPages: 0,
  currentPage: 1,
  nextPage: 2,
  prevPage: null,
};
```

## Fields

| Field                                                          | Type                                                           | Required                                                       | Description                                                    | Example                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `totalRecords`                                                 | *number*                                                       | :heavy_check_mark:                                             | Total number of records in the list                            | 0                                                              |
| `totalPages`                                                   | *number*                                                       | :heavy_check_mark:                                             | Total number of pages available                                | 0                                                              |
| `currentPage`                                                  | *number*                                                       | :heavy_check_mark:                                             | The current page number                                        | 1                                                              |
| `nextPage`                                                     | *number*                                                       | :heavy_check_mark:                                             | The next page number, or null if there is no next page         | 2                                                              |
| `prevPage`                                                     | *number*                                                       | :heavy_check_mark:                                             | The previous page number, or null if there is no previous page | <nil>                                                          |