# FileUploadEntity

## Example Usage

```typescript
import { FileUploadEntity } from "creem/models/components";

let value: FileUploadEntity = {
  id: "file_4dGTkmBdnTnU9vV3KZ2Hcz",
  uploadUrl: "https://creem-files.s3.eu-west-1.amazonaws.com/",
  uploadFields: {
    "key": "store/sto_1/0b6f2c1e-ebook.epub",
    "Content-Type": "application/epub+zip",
  },
  expiresAt: new Date("2026-11-17T11:00:00.000Z"),
};
```

## Fields

| Field                                                                                                                                     | Type                                                                                                                                      | Required                                                                                                                                  | Description                                                                                                                               | Example                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                                      | *string*                                                                                                                                  | :heavy_check_mark:                                                                                                                        | The id of the upload. Confirm it with `POST /v1/files/{id}/confirm`; the file keeps this id once confirmed.                               | file_4dGTkmBdnTnU9vV3KZ2Hcz                                                                                                               |
| `uploadUrl`                                                                                                                               | *string*                                                                                                                                  | :heavy_check_mark:                                                                                                                        | Where to upload the file: a `multipart/form-data` POST with every `upload_fields` entry first and the file last, in a field named `file`. | https://creem-files.s3.eu-west-1.amazonaws.com/                                                                                           |
| `uploadFields`                                                                                                                            | Record<string, *string*>                                                                                                                  | :heavy_check_mark:                                                                                                                        | The form fields to send with the upload, unchanged and before the file.                                                                   | {<br/>"key": "store/sto_1/0b6f2c1e-ebook.epub",<br/>"Content-Type": "application/epub+zip"<br/>}                                          |
| `expiresAt`                                                                                                                               | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)                                             | :heavy_check_mark:                                                                                                                        | When the upload expires (ISO 8601). Upload and confirm the file before then.                                                              | 2026-11-17T11:00:00.000Z                                                                                                                  |