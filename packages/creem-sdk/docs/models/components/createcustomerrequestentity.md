# CreateCustomerRequestEntity

## Example Usage

```typescript
import { CreateCustomerRequestEntity } from "creem/models/components";

let value: CreateCustomerRequestEntity = {
  email: "john@example.com",
  name: "John Doe",
  metadata: {},
};
```

## Fields

| Field                                                                                                            | Type                                                                                                             | Required                                                                                                         | Description                                                                                                      | Example                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `email`                                                                                                          | *string*                                                                                                         | :heavy_check_mark:                                                                                               | The email address of the customer.                                                                               | john@example.com                                                                                                 |
| `name`                                                                                                           | *string*                                                                                                         | :heavy_check_mark:                                                                                               | The full name of the customer.                                                                                   | John Doe                                                                                                         |
| `metadata`                                                                                                       | [components.CreateCustomerRequestEntityMetadata](../../models/components/createcustomerrequestentitymetadata.md) | :heavy_minus_sign:                                                                                               | Additional metadata for the customer.                                                                            | {<br/>"key": "value"<br/>}                                                                                       |