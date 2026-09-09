# DisputeEntityOrder

The order associated with the dispute.


## Supported Types

### `string`

```typescript
const value: string = "<value>";
```

### `components.OrderEntity`

```typescript
const value: components.OrderEntity = {
  id: "<id>",
  mode: "test",
  object: "<value>",
  product: "Fantastic Soft Table",
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
  status: "pending",
  type: "onetime",
  createdAt: new Date("2023-09-13T00:00:00Z"),
  updatedAt: new Date("2023-09-13T00:00:00Z"),
};
```

