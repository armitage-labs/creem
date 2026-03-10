# CheckoutEntity

## Example Usage

```typescript
import { CheckoutEntity } from "creem/models/components";

let value: CheckoutEntity = {
  id: "<id>",
  mode: "prod",
  object: "<value>",
  status: "completed",
  product: {
    id: "<id>",
    mode: "sandbox",
    object: "<value>",
    name: "<value>",
    description: "This is a sample product description.",
    imageUrl: "https://example.com/image.jpg",
    features: [
      {
        id: "feat_abc123",
        type: "file",
        description: "Access to premium course materials.",
      },
    ],
    price: 400,
    currency: "USD",
    billingType: "onetime",
    billingPeriod: "every-three-months",
    status: "archived",
    taxMode: "exclusive",
    taxCategory: "saas",
    productUrl: "https://creem.io/product/prod_123123123123",
    defaultSuccessUrl: "https://example.com/?status=successful",
    createdAt: new Date("2023-01-01T00:00:00Z"),
    updatedAt: new Date("2023-01-01T00:00:00Z"),
  },
  order: {
    id: "<id>",
    mode: "prod",
    object: "<value>",
    product: "Elegant Rubber Car",
    transaction: "tx_1234567890",
    discount: "dis_1234567890",
    amount: 2000,
    subTotal: 1800,
    taxAmount: 200,
    discountAmount: 100,
    amountDue: 1900,
    amountPaid: 1900,
    currency: "USD",
    fxAmount: 15,
    fxCurrency: "EUR",
    fxRate: 1.2,
    status: "paid",
    type: "recurring",
    createdAt: new Date("2023-09-13T00:00:00Z"),
    updatedAt: new Date("2023-09-13T00:00:00Z"),
  },
  subscription: "<value>",
  customer: "<value>",
  successUrl: "https://example.com/return",
  feature: [
    {
      id: "feat_abc123",
      description: "Get access to the full course materials.",
      privateNote:
        "Thank you for your purchase! Here is your access code: XYZ123",
      file: {
        files: [
          {
            id: "file_abc123",
            fileName: "ebook.pdf",
            url: "https://storage.creem.io/files/ebook.pdf",
            type: "application/pdf",
            size: 1024000,
          },
        ],
      },
      licenseKey: {
        id: "<id>",
        mode: "test",
        object: "<value>",
        status: "active",
        key: "ABC123-XYZ456-XYZ456-XYZ456",
        activation: 5,
        activationLimit: 1,
        expiresAt: new Date("2023-09-13T00:00:00Z"),
        createdAt: new Date("2023-09-13T00:00:00Z"),
        instance: null,
      },
    },
  ],
  metadata: {
    "userId": "user_123",
    "visitCount": 42,
    "lastVisit": "2023-04-01",
  },
};
```

## Fields

| Field                                                                                 | Type                                                                                  | Required                                                                              | Description                                                                           | Example                                                                               |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `id`                                                                                  | *string*                                                                              | :heavy_check_mark:                                                                    | Unique identifier for the object.                                                     |                                                                                       |
| `mode`                                                                                | [components.EnvironmentMode](../../models/components/environmentmode.md)              | :heavy_check_mark:                                                                    | String representing the environment.                                                  |                                                                                       |
| `object`                                                                              | *string*                                                                              | :heavy_check_mark:                                                                    | String representing the object's type. Objects of the same type share the same value. |                                                                                       |
| `status`                                                                              | [components.Status](../../models/components/status.md)                                | :heavy_check_mark:                                                                    | Status of the checkout.                                                               | completed                                                                             |
| `requestId`                                                                           | *string*                                                                              | :heavy_minus_sign:                                                                    | Identify and track each checkout request.                                             |                                                                                       |
| `product`                                                                             | *components.CheckoutEntityProduct*                                                    | :heavy_check_mark:                                                                    | The product associated with the checkout session.                                     |                                                                                       |
| `units`                                                                               | *number*                                                                              | :heavy_minus_sign:                                                                    | The number of units for the of the product.                                           |                                                                                       |
| `order`                                                                               | [components.OrderEntity](../../models/components/orderentity.md)                      | :heavy_minus_sign:                                                                    | The order associated with the checkout session.                                       |                                                                                       |
| `subscription`                                                                        | *components.Subscription*                                                             | :heavy_minus_sign:                                                                    | The subscription associated with the checkout session.                                |                                                                                       |
| `customer`                                                                            | *components.CheckoutEntityCustomer*                                                   | :heavy_minus_sign:                                                                    | The customer associated with the checkout session.                                    |                                                                                       |
| `customFields`                                                                        | [components.CustomField](../../models/components/customfield.md)[]                    | :heavy_minus_sign:                                                                    | Additional information collected from your customer during the checkout process.      |                                                                                       |
| `checkoutUrl`                                                                         | *string*                                                                              | :heavy_minus_sign:                                                                    | The URL to which the customer will be redirected to complete the payment.             |                                                                                       |
| `successUrl`                                                                          | *string*                                                                              | :heavy_minus_sign:                                                                    | The URL to which the user will be redirected after the checkout process is completed. | https://example.com/return                                                            |
| `feature`                                                                             | [components.ProductFeatureEntity](../../models/components/productfeatureentity.md)[]  | :heavy_minus_sign:                                                                    | Features issued for the order.                                                        |                                                                                       |
| `metadata`                                                                            | Record<string, *any*>                                                                 | :heavy_minus_sign:                                                                    | Metadata for the checkout in the form of key-value pairs                              | {<br/>"userId": "user_123",<br/>"visitCount": 42,<br/>"lastVisit": "2023-04-01"<br/>} |