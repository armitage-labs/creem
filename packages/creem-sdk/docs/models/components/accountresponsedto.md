# AccountResponseDto

## Example Usage

```typescript
import { AccountResponseDto } from "creem/models/components";

let value: AccountResponseDto = {
  id: "cca_abc123",
  storeId: "<id>",
  customerId: "cust_abc123",
  name: "default",
  unitLabel: "credits",
  status: "active",
  createdAt: "1734530136050",
  updatedAt: "1735617829027",
};
```

## Fields

| Field                                                                                      | Type                                                                                       | Required                                                                                   | Description                                                                                | Example                                                                                    |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `id`                                                                                       | *string*                                                                                   | :heavy_check_mark:                                                                         | Account ID                                                                                 | cca_abc123                                                                                 |
| `storeId`                                                                                  | *string*                                                                                   | :heavy_check_mark:                                                                         | Store ID                                                                                   |                                                                                            |
| `customerId`                                                                               | *string*                                                                                   | :heavy_check_mark:                                                                         | Owner ID                                                                                   | cust_abc123                                                                                |
| `name`                                                                                     | *string*                                                                                   | :heavy_check_mark:                                                                         | Account name                                                                               | default                                                                                    |
| `unitLabel`                                                                                | *string*                                                                                   | :heavy_check_mark:                                                                         | Unit label                                                                                 | credits                                                                                    |
| `status`                                                                                   | [components.AccountResponseDtoStatus](../../models/components/accountresponsedtostatus.md) | :heavy_check_mark:                                                                         | Account status                                                                             |                                                                                            |
| `createdAt`                                                                                | *string*                                                                                   | :heavy_check_mark:                                                                         | Creation timestamp                                                                         |                                                                                            |
| `updatedAt`                                                                                | *string*                                                                                   | :heavy_check_mark:                                                                         | Last update timestamp                                                                      |                                                                                            |