# UpdateCustomerRequestEntity

## Example Usage

```typescript
import { UpdateCustomerRequestEntity } from "creem/models/components";

let value: UpdateCustomerRequestEntity = {
  customerId: "cust_abc123",
  name: "John Doe",
  metadata: {},
};
```

## Fields

| Field                                                                                                            | Type                                                                                                             | Required                                                                                                         | Description                                                                                                      | Example                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `customerId`                                                                                                     | *string*                                                                                                         | :heavy_check_mark:                                                                                               | The ID of the customer to update.                                                                                | cust_abc123                                                                                                      |
| `name`                                                                                                           | *string*                                                                                                         | :heavy_minus_sign:                                                                                               | The full name of the customer.                                                                                   | John Doe                                                                                                         |
| `metadata`                                                                                                       | [components.UpdateCustomerRequestEntityMetadata](../../models/components/updatecustomerrequestentitymetadata.md) | :heavy_minus_sign:                                                                                               | Additional metadata for the customer.                                                                            | {<br/>"key": "value"<br/>}                                                                                       |