<div align="center">
  <h1>Creem SDK</h1>
  <p>The official Creem SDK for JavaScript & TypeScript</p>
  <p>Universal payment integration that works with any framework - Express, Fastify, Hono, Remix, Koa, and more.</p>
  
  <a href="#installation">Installation</a> · 
  <a href="#quick-start">Quick Start</a> · 
  <a href="#documentation">Documentation</a>
</div>

---

## Introduction

The Creem SDK is a framework-agnostic JavaScript/TypeScript library for integrating [Creem](https://www.creem.io) payments into any application. This SDK provides:

- 🚀 **Framework Agnostic** - Works with Express, Fastify, Next.js, Remix, Hono, Koa, and any Node.js environment
- 🔐 **Type-Safe** - Full TypeScript support with comprehensive type definitions
- 📦 **Zero Dependencies** - Lightweight with minimal footprint (only crypto for webhooks)
- 🎯 **Simple API** - Intuitive methods for all Creem operations
- 🪝 **Webhook Support** - Built-in webhook verification and type-safe handlers
- ⚡ **CamelCase** - All responses automatically converted from snake_case to camelCase for better DX

---

## Installation

Install the package using your preferred package manager:

#### npm

```bash
npm install creem
```

#### yarn

```bash
yarn add creem
```

#### pnpm

```bash
pnpm install creem
```

### Requirements

- Node.js 16.0.0 or higher
- A [Creem account](https://creem.io) with API keys

---

## Quick Start

### 1. Initialize the SDK

```typescript
import { createCreem } from "creem";

const creem = createCreem({
  apiKey: "your_api_key_here",
  testMode: true, // Set to false for production
  webhookSecret: "your_webhook_secret_here", // Optional, for webhooks
});
```

### 2. Create a checkout session

```typescript
const checkout = await creem.checkouts.create({
  productId: "prod_abc123",
  units: 1,
  successUrl: "https://yoursite.com/success",
  customer: {
    email: "customer@example.com",
    name: "John Doe",
  },
  metadata: {
    userId: "user_123",
  },
});

// Redirect user to checkout
console.log(checkout.checkoutUrl);
```

### 3. Handle webhooks

#### Express Example

```typescript
import express from "express";
import { createCreem } from "creem";

const app = express();
const creem = createCreem({
  apiKey: process.env.CREEM_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
});

app.post(
  "/webhook/creem",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const signature = req.headers["creem-signature"] as string;

      await creem.webhooks.handleEvents(req.body, signature, {
        onCheckoutCompleted: async ({ customer, product }) => {
          console.log(`${customer?.email} purchased ${product.name}`);
        },
        onGrantAccess: async ({ reason, customer, metadata }) => {
          // Grant user access to your platform
          console.log(`Grant access: ${reason} to ${customer.email}`);
        },
        onRevokeAccess: async ({ reason, customer, metadata }) => {
          // Revoke user access from your platform
          console.log(`Revoke access: ${reason} from ${customer.email}`);
        },
      });

      res.status(200).send("OK");
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).send("Invalid signature");
    }
  }
);
```

That's it! You now have Creem payments integrated. 🎉

---

## Documentation

### Initialization

```typescript
import { createCreem } from "creem";

const creem = createCreem({
  apiKey: string;          // Required: Your Creem API key
  testMode?: boolean;      // Optional: Use test environment (default: false)
  webhookSecret?: string;  // Optional: For webhook signature verification
  baseUrl?: string;        // Optional: Custom API base URL
});
```

---

### Checkouts

#### Create a checkout session

```typescript
const checkout = await creem.checkouts.create({
  productId: "prod_abc123",
  requestId: "unique_request_id", // Optional: Idempotency key
  units: 2,
  discountCode: "SUMMER2024",
  customer: {
    email: "customer@example.com",
    name: "John Doe",
  },
  customField: [
    // Optional: Max 3 custom fields
    {
      key: "company",
      label: "Company Name",
      type: "text",
      optional: false,
    },
  ],
  successUrl: "https://yoursite.com/success",
  metadata: {
    userId: "user_123",
    source: "web",
  },
});
```

#### Get a checkout session

```typescript
const checkout = await creem.checkouts.get({
  checkoutId: "checkout_abc123",
});
```

---

### Products

#### List products

```typescript
const products = await creem.products.list({
  page: 1,
  limit: 10,
});
```

#### Get a product

```typescript
const product = await creem.products.get({
  productId: "prod_abc123",
});
```

#### Create a product

```typescript
const product = await creem.products.create({
  name: "Pro Plan",
  description: "Professional tier with all features",
  price: 2999, // $29.99 in cents
  currency: "USD",
  billingType: "recurring",
  billingPeriod: "every-month",
  taxMode: "inclusive",
  taxCategory: "saas",
  defaultSuccessUrl: "https://yoursite.com/success",
});
```

---

### Customers

#### List customers

```typescript
const customers = await creem.customers.list({
  page: 1,
  limit: 10,
});
```

#### Get a customer

```typescript
// By ID
const customer = await creem.customers.get({
  customerId: "cust_abc123",
});

// By email
const customer = await creem.customers.get({
  email: "customer@example.com",
});
```

#### Create portal link

```typescript
const portal = await creem.customers.createPortal({
  customerId: "cust_abc123",
});

// Redirect user to portal
console.log(portal.url);
```

---

### Subscriptions

#### Get a subscription

```typescript
const subscription = await creem.subscriptions.get({
  subscriptionId: "sub_abc123",
});
```

#### Cancel a subscription

```typescript
const subscription = await creem.subscriptions.cancel({
  subscriptionId: "sub_abc123",
});
```

#### Update a subscription

```typescript
const subscription = await creem.subscriptions.update({
  subscriptionId: "sub_abc123",
  items: [
    {
      id: "item_abc123",
      units: 5,
    },
  ],
  updateBehavior: "immediate", // or "next_billing_cycle"
});
```

#### Upgrade a subscription

```typescript
const subscription = await creem.subscriptions.upgrade({
  subscriptionId: "sub_abc123",
  productId: "prod_premium",
  updateBehavior: "immediate",
});
```

---

### Licenses

#### Activate a license

```typescript
const license = await creem.licenses.activate({
  key: "license_key_here",
  instanceName: "Production Server",
});
```

#### Deactivate a license

```typescript
const license = await creem.licenses.deactivate({
  key: "license_key_here",
  instanceId: "inst_abc123",
});
```

#### Validate a license

```typescript
const license = await creem.licenses.validate({
  key: "license_key_here",
  instanceId: "inst_abc123",
});
```

---

### Discounts

#### Get a discount

```typescript
// By ID
const discount = await creem.discounts.get({
  discountId: "disc_abc123",
});

// By code
const discount = await creem.discounts.get({
  discountCode: "SUMMER2024",
});
```

#### Create a discount

```typescript
const discount = await creem.discounts.create({
  name: "Summer Sale",
  code: "SUMMER2024", // Optional: Auto-generated if not provided
  type: "percentage",
  percentage: 25, // 25% off
  duration: "forever",
  maxRedemptions: 100,
  expiryDate: "2024-12-31",
  appliesToProducts: ["prod_abc123"],
});
```

#### Delete a discount

```typescript
await creem.discounts.delete({
  discountId: "disc_abc123",
});
```

---

### Transactions

#### Get a transaction

```typescript
const transaction = await creem.transactions.get({
  transactionId: "txn_abc123",
});
```

#### List transactions

```typescript
const transactions = await creem.transactions.list({
  customerId: "cust_abc123",
  page: 1,
  limit: 10,
});
```

---

### Webhooks

The SDK provides a framework-agnostic webhook handler with automatic signature verification.

#### Basic Setup (Any Framework)

```typescript
// Get raw body as string or Buffer
const payload = await getRawBody(request);
const signature = request.headers["creem-signature"];

await creem.webhooks.handleEvents(payload, signature, {
  onCheckoutCompleted: async (data) => {
    // Access all fields directly
    const { customer, product, order, subscription, metadata } = data;
  },

  onGrantAccess: async (context) => {
    // Called for: subscription.active, subscription.trialing, subscription.paid
    const { reason, customer, product, metadata } = context;
    // Grant user access to your platform
  },

  onRevokeAccess: async (context) => {
    // Called for: subscription.paused, subscription.expired
    const { reason, customer, product, metadata } = context;
    // Revoke user access from your platform
  },

  // Individual subscription events
  onSubscriptionActive: async (data) => {},
  onSubscriptionTrialing: async (data) => {},
  onSubscriptionCanceled: async (data) => {},
  onSubscriptionPaid: async (data) => {},
  onSubscriptionExpired: async (data) => {},
  onSubscriptionUnpaid: async (data) => {},
  onSubscriptionPastDue: async (data) => {},
  onSubscriptionPaused: async (data) => {},
  onSubscriptionUpdate: async (data) => {},

  // Other events
  onRefundCreated: async (data) => {},
  onDisputeCreated: async (data) => {},
});
```

#### Framework Examples

**Express**

```typescript
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      await creem.webhooks.handleEvents(
        req.body,
        req.headers["creem-signature"],
        {
          /* handlers */
        }
      );
      res.status(200).send("OK");
    } catch (error) {
      res.status(400).send("Invalid signature");
    }
  }
);
```

**Fastify**

```typescript
fastify.post("/webhook", async (request, reply) => {
  try {
    await creem.webhooks.handleEvents(
      request.rawBody,
      request.headers["creem-signature"],
      {
        /* handlers */
      }
    );
    reply.code(200).send("OK");
  } catch (error) {
    reply.code(400).send("Invalid signature");
  }
});
```

**Hono**

```typescript
app.post("/webhook", async (c) => {
  try {
    const body = await c.req.text();
    const signature = c.req.header("creem-signature");

    await creem.webhooks.handleEvents(body, signature, {
      /* handlers */
    });

    return c.text("OK");
  } catch (error) {
    return c.text("Invalid signature", 400);
  }
});
```

---

## TypeScript Support

The SDK is written in TypeScript and provides comprehensive type definitions for all operations:

```typescript
import type {
  Checkout,
  Customer,
  Product,
  Subscription,
  Transaction,
  License,
  Discount,
  WebhookOptions,
  CheckoutCompletedEvent,
  SubscriptionEvent,
  GrantAccessContext,
  RevokeAccessContext,
} from "creem";
```

All API responses are fully typed, and the SDK automatically converts snake_case to camelCase for better TypeScript/JavaScript experience.

---

## Error Handling

```typescript
try {
  const checkout = await creem.checkouts.create({
    productId: "prod_abc123",
    // ...
  });
} catch (error) {
  if (error instanceof Error) {
    console.error("Failed to create checkout:", error.message);
  }
}
```

---

## Best Practices

### 1. Use Environment Variables

```typescript
const creem = createCreem({
  apiKey: process.env.CREEM_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  testMode: process.env.NODE_ENV !== "production",
});
```

### 2. Implement Idempotent Webhooks

Webhook handlers may be called multiple times. Always make them idempotent:

```typescript
onGrantAccess: async ({ customer, metadata }) => {
  // Use upsert instead of create
  await db.user.upsert({
    where: { id: metadata.userId },
    update: { subscriptionActive: true },
    create: { id: metadata.userId, subscriptionActive: true },
  });
};
```

### 3. Use Request IDs for Idempotency

```typescript
const checkout = await creem.checkouts.create({
  requestId: `checkout-${userId}-${Date.now()}`,
  productId: "prod_abc123",
  // ...
});
```

### 4. Store Metadata

Use metadata to track your internal IDs:

```typescript
metadata: {
  userId: user.id,
  orderId: order.id,
  source: "web",
  campaign: "summer_sale",
}
```

---

## Framework Adapters

Looking for a ready-made integration for your framework?

- **Next.js**: [`@creem_io/nextjs`](https://www.npmjs.com/package/@creem_io/nextjs) - React components and route handlers

---

## Contributing

We welcome contributions! Please open an issue or submit a pull request.

---

## Support

- 📧 **Email**: support@creem.io
- 💬 **Discord**: [Join our community](https://discord.gg/q3GKZs92Av)
- 📚 **Documentation**: [docs.creem.io](https://docs.creem.io)
- 🐛 **Issues**: [GitHub Issues](https://github.com/creem-io/creem-sdk/issues)

---

## License

MIT © [Creem](https://creem.io)

---

## Authors

Built with ❤️ by the [Creem](https://creem.io) team.

