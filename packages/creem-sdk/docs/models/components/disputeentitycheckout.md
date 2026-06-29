# DisputeEntityCheckout

The checkout associated with the dispute.


## Supported Types

### `string`

```typescript
const value: string = "<value>";
```

### `components.CheckoutEntity`

```typescript
const value: components.CheckoutEntity = {
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
        type: "licenseKey",
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
  customPrice: 1500,
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
  licenseKeys: [
    {
      id: "<id>",
      mode: "prod",
      object: "<value>",
      productId: "prod_abc123",
      status: "expired",
      key: "ABC123-XYZ456-XYZ456-XYZ456",
      activation: 5,
      activationLimit: 1,
      expiresAt: new Date("2023-09-13T00:00:00Z"),
      createdAt: new Date("2023-09-13T00:00:00Z"),
      instance: {
        id: "<id>",
        mode: "prod",
        object: "license-instance",
        name: "My Customer License Instance",
        status: "active",
        createdAt: new Date("2023-09-13T00:00:00Z"),
      },
    },
  ],
  metadata: {
    "userId": "user_123",
    "visitCount": 42,
    "lastVisit": "2023-04-01",
  },
  discount: {
    id: "dis_3e6Z6TzvHKdsjEgXnGDEp0",
    discountCode: "HOLIDAY2024",
  },
};
```

