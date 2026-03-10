# CustomerEntity

## Example Usage

```typescript
import { CustomerEntity } from "creem/models/components";

let value: CustomerEntity = {
  id: "<id>",
  mode: "prod",
  object: "<value>",
  email: "user@example.com",
  name: "John Doe",
  country: "US",
  createdAt: new Date("2023-01-01T00:00:00Z"),
  updatedAt: new Date("2023-01-01T00:00:00Z"),
};
```

## Fields

| Field                                                                                         | Type                                                                                          | Required                                                                                      | Description                                                                                   | Example                                                                                       |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `id`                                                                                          | *string*                                                                                      | :heavy_check_mark:                                                                            | Unique identifier for the object.                                                             |                                                                                               |
| `mode`                                                                                        | [components.EnvironmentMode](../../models/components/environmentmode.md)                      | :heavy_check_mark:                                                                            | String representing the environment.                                                          |                                                                                               |
| `object`                                                                                      | *string*                                                                                      | :heavy_check_mark:                                                                            | String representing the object’s type. Objects of the same type share the same value.         |                                                                                               |
| `email`                                                                                       | *string*                                                                                      | :heavy_check_mark:                                                                            | Customer email address.                                                                       | user@example.com                                                                              |
| `name`                                                                                        | *string*                                                                                      | :heavy_minus_sign:                                                                            | Customer name.                                                                                | John Doe                                                                                      |
| `country`                                                                                     | *string*                                                                                      | :heavy_check_mark:                                                                            | The ISO alpha-2 country code for the customer.                                                | US                                                                                            |
| `createdAt`                                                                                   | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) | :heavy_check_mark:                                                                            | Creation date of the product                                                                  | 2023-01-01T00:00:00Z                                                                          |
| `updatedAt`                                                                                   | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) | :heavy_check_mark:                                                                            | Last updated date of the product                                                              | 2023-01-01T00:00:00Z                                                                          |