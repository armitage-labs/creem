# Product

The product associated with the subscription.


## Supported Types

### `components.ProductEntity`

```typescript
const value: components.ProductEntity = {
  id: "<id>",
  mode: "test",
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
  taxMode: "inclusive",
  taxCategory: "ebooks",
  productUrl: "https://creem.io/product/prod_123123123123",
  defaultSuccessUrl: "https://example.com/?status=successful",
  createdAt: new Date("2023-01-01T00:00:00Z"),
  updatedAt: new Date("2023-01-01T00:00:00Z"),
};
```

### `string`

```typescript
const value: string = "<value>";
```

