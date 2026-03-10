# SubscriptionEntity

## Example Usage

```typescript
import { SubscriptionEntity } from "creem/models/components";

let value: SubscriptionEntity = {
  id: "<id>",
  mode: "prod",
  object: "subscription",
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
  customer: {
    id: "<id>",
    mode: "prod",
    object: "<value>",
    email: "user@example.com",
    name: "John Doe",
    country: "US",
    createdAt: new Date("2023-01-01T00:00:00Z"),
    updatedAt: new Date("2023-01-01T00:00:00Z"),
  },
  collectionMethod: "charge_automatically",
  status: "active",
  lastTransactionId: "tran_3e6Z6TzvHKdsjEgXnGDEp0",
  lastTransaction: {
    id: "<id>",
    mode: "sandbox",
    object: "transaction",
    amount: 2000,
    amountPaid: 2000,
    discountAmount: 2000,
    currency: "USD",
    type: "invoice",
    taxCountry: "US",
    taxAmount: 2000,
    status: "uncollectible",
    refundedAmount: 2000,
    createdAt: 3801.23,
  },
  lastTransactionDate: new Date("2024-09-12T12:34:56Z"),
  nextTransactionDate: new Date("2024-09-12T12:34:56Z"),
  currentPeriodStartDate: new Date("2024-09-12T12:34:56Z"),
  currentPeriodEndDate: new Date("2024-09-12T12:34:56Z"),
  canceledAt: new Date("2024-09-12T12:34:56Z"),
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-09-12T12:34:56Z"),
};
```

## Fields

| Field                                                                                              | Type                                                                                               | Required                                                                                           | Description                                                                                        | Example                                                                                            |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `id`                                                                                               | *string*                                                                                           | :heavy_check_mark:                                                                                 | Unique identifier for the object.                                                                  |                                                                                                    |
| `mode`                                                                                             | [components.EnvironmentMode](../../models/components/environmentmode.md)                           | :heavy_check_mark:                                                                                 | String representing the environment.                                                               |                                                                                                    |
| `object`                                                                                           | *string*                                                                                           | :heavy_check_mark:                                                                                 | String representing the object's type. Objects of the same type share the same value.              | subscription                                                                                       |
| `product`                                                                                          | *components.Product*                                                                               | :heavy_check_mark:                                                                                 | The product associated with the subscription.                                                      |                                                                                                    |
| `customer`                                                                                         | *components.Customer*                                                                              | :heavy_check_mark:                                                                                 | The customer who owns the subscription.                                                            |                                                                                                    |
| `items`                                                                                            | [components.SubscriptionItemEntity](../../models/components/subscriptionitementity.md)[]           | :heavy_minus_sign:                                                                                 | Subscription items.                                                                                |                                                                                                    |
| `collectionMethod`                                                                                 | [components.SubscriptionCollectionMethod](../../models/components/subscriptioncollectionmethod.md) | :heavy_check_mark:                                                                                 | The method used for collecting payments for the subscription.                                      |                                                                                                    |
| `status`                                                                                           | [components.SubscriptionStatus](../../models/components/subscriptionstatus.md)                     | :heavy_check_mark:                                                                                 | The current status of the subscription.                                                            |                                                                                                    |
| `lastTransactionId`                                                                                | *string*                                                                                           | :heavy_minus_sign:                                                                                 | The ID of the last paid transaction.                                                               | tran_3e6Z6TzvHKdsjEgXnGDEp0                                                                        |
| `lastTransaction`                                                                                  | [components.TransactionEntity](../../models/components/transactionentity.md)                       | :heavy_minus_sign:                                                                                 | The last paid transaction.                                                                         |                                                                                                    |
| `lastTransactionDate`                                                                              | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)      | :heavy_minus_sign:                                                                                 | The date of the last paid transaction.                                                             | 2024-09-12T12:34:56Z                                                                               |
| `nextTransactionDate`                                                                              | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)      | :heavy_minus_sign:                                                                                 | The date when the next subscription transaction will be charged.                                   | 2024-09-12T12:34:56Z                                                                               |
| `currentPeriodStartDate`                                                                           | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)      | :heavy_minus_sign:                                                                                 | The start date of the current subscription period.                                                 | 2024-09-12T12:34:56Z                                                                               |
| `currentPeriodEndDate`                                                                             | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)      | :heavy_minus_sign:                                                                                 | The end date of the current subscription period.                                                   | 2024-09-12T12:34:56Z                                                                               |
| `canceledAt`                                                                                       | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)      | :heavy_minus_sign:                                                                                 | The date and time when the subscription was canceled, if applicable.                               | 2024-09-12T12:34:56Z                                                                               |
| `createdAt`                                                                                        | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)      | :heavy_check_mark:                                                                                 | The date and time when the subscription was created.                                               | 2024-01-01T00:00:00Z                                                                               |
| `updatedAt`                                                                                        | [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)      | :heavy_check_mark:                                                                                 | The date and time when the subscription was last updated.                                          | 2024-09-12T12:34:56Z                                                                               |
| `discount`                                                                                         | [components.Discount](../../models/components/discount.md)                                         | :heavy_minus_sign:                                                                                 | The discount code applied to the subscription, if any.                                             |                                                                                                    |