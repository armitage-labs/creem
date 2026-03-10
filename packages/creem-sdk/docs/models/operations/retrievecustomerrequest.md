# RetrieveCustomerRequest

## Example Usage

```typescript
import { RetrieveCustomerRequest } from "creem/models/operations";

let value: RetrieveCustomerRequest = {
  customerId: "cust_1234567890",
  email: "customer@example.com",
};
```

## Fields

| Field                                  | Type                                   | Required                               | Description                            | Example                                |
| -------------------------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------- |
| `customerId`                           | *string*                               | :heavy_minus_sign:                     | The unique identifier of the customer. | cust_1234567890                        |
| `email`                                | *string*                               | :heavy_minus_sign:                     | The email address of the customer.     | customer@example.com                   |