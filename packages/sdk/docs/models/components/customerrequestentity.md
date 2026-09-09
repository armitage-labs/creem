# CustomerRequestEntity

## Example Usage

```typescript
import { CustomerRequestEntity } from "creem/models/components";

let value: CustomerRequestEntity = {
  id: "cust_1234567890",
  email: "user@example.com",
  name: "John Doe",
};
```

## Fields

| Field                                                                                         | Type                                                                                          | Required                                                                                      | Description                                                                                   | Example                                                                                       |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `id`                                                                                          | *string*                                                                                      | :heavy_minus_sign:                                                                            | Unique identifier of the customer. You may specify only one of these parameters: id or email. | cust_1234567890                                                                               |
| `email`                                                                                       | *string*                                                                                      | :heavy_minus_sign:                                                                            | Customer email address. You may only specify one of these parameters: id, email.              | user@example.com                                                                              |
| `name`                                                                                        | *string*                                                                                      | :heavy_minus_sign:                                                                            | Customer full name. Used to prefill the name field on the checkout page.                      | John Doe                                                                                      |