<div align="center">
  <h1>@creem_io/nextjs</h1>
  <p>The simplest way to integrate Creem payments into your Next.js application.</p>
  <p>Build beautiful checkout experiences with React components, handle webhooks with ease, and manage subscriptions without the headache.</p>
  
  <a href="#installation">Installation</a> · 
  <a href="#quick-start">Quick Start</a> · 
  <a href="#documentation">Documentation</a>
</div>

---

## Introduction

`@creem_io/nextjs` is the official Next.js integration for [Creem](https://www.creem.io) - a modern payment platform. This library provides:

- 🎨 **React Components** - Drop-in components for checkout and customer portal
- 🔐 **Type-Safe** - Full TypeScript support with comprehensive type definitions
- ⚡ **Zero Config** - Works out of the box with Next.js App Router
- 🪝 **Webhook Management** - Simple, type-safe webhook handlers with automatic verification
- 🔄 **Subscription Lifecycle** - Built-in access management for subscription-based products

---

## Installation

Install the package using your preferred package manager:

#### npm

```bash
npm install @creem_io/nextjs
```

#### yarn

```bash
yarn add @creem_io/nextjs
```

#### pnpm

```bash
pnpm install @creem_io/nextjs
```

### Requirements

- Next.js 13.0.0 or higher (App Router)
- React 18.0.0 or higher
- A [Creem account](https://creem.io) with API keys

> **Note:** This package uses the Creem SDK v1.3.6+ internally. The SDK is bundled as a dependency.

---

## Quick Start

### 1. Set up your environment variables

Create a `.env.local` file in your project root:

```bash
CREEM_API_KEY=your_api_key_here
CREEM_WEBHOOK_SECRET=your_webhook_secret_here
```

### 2. Create a checkout route

Create `app/checkout/route.ts`:

```typescript
import { Checkout } from "@creem_io/nextjs";

export const GET = Checkout({
  apiKey: process.env.CREEM_API_KEY!,
  testMode: true, // Set to false for production
});
```

### 3. Add a checkout button to your page

In your `app/page.tsx` or any client component:

```typescript
"use client";

import { CreemCheckout } from "@creem_io/nextjs";

export default function Page() {
  return (
    <CreemCheckout productId="prod_abc123" successUrl="/thank-you">
      <button className="btn-primary">Subscribe Now</button>
    </CreemCheckout>
  );
}
```

### 4. Handle webhooks

Create `app/api/webhook/creem/route.ts`:

```typescript
import { Webhook } from "@creem_io/nextjs";

export const POST = Webhook({
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,

  onCheckoutCompleted: async ({ customer, product }) => {
    console.log(`${customer.email} purchased ${product.name}`);
  },

  onGrantAccess: async ({ reason, customer, metadata }) => {
    const userId = metadata?.referenceId as string;
    // Grant user access to your platform
  },

  onRevokeAccess: async ({ reason, customer, metadata }) => {
    const userId = metadata?.referenceId as string;
    // Revoke user access from your platform
  },
});
```

That's it! You now have a working payment integration in Next.js. 🎉

---

## Documentation

### Client Components

#### `<CreemCheckout />`

A React component that creates a checkout link. When clicked, redirects users to your checkout route handler which creates a Creem checkout session.

```typescript
import { CreemCheckout } from "@creem_io/nextjs";

<CreemCheckout
  productId="prod_abc123"
  units={2}
  discountCode="SUMMER2024"
  customer={{
    email: "user@example.com",
    name: "John Doe",
  }}
  successUrl="/thank-you"
  metadata={{
    orderId: "12345",
    source: "web",
  }}
  referenceId="user_123"
>
  <button>Buy Now</button>
</CreemCheckout>;
```

**Props:**

| Prop           | Type        | Required | Description                                     |
| -------------- | ----------- | -------- | ----------------------------------------------- |
| `productId`    | `string`    | ✅       | The Creem product ID from your dashboard        |
| `units`        | `number`    | ❌       | Number of units to purchase (default: 1)        |
| `discountCode` | `string`    | ❌       | Discount code to apply                          |
| `customer`     | `object`    | ❌       | Pre-fill customer information (`email`, `name`) |
| `successUrl`   | `string`    | ❌       | URL to redirect after successful payment        |
| `metadata`     | `object`    | ❌       | Custom metadata to attach to the checkout       |
| `referenceId`  | `string`    | ❌       | Your internal user/order ID                     |
| `customFields` | `object`    | ❌       | Custom fields to store with the checkout        |
| `checkoutPath` | `string`    | ❌       | Custom API route path (default: `/checkout`)    |
| `children`     | `ReactNode` | ❌       | Custom button or link content                   |

---

#### `<CreemPortal />`

A React component that creates a customer portal link for managing subscriptions, payment methods, and billing history.

```typescript
import { CreemPortal } from "@creem_io/nextjs";

<CreemPortal
  customerId="cust_abc123"
  className="btn-secondary"
>
  Manage Subscription
</CreemPortal>;
```

**Props:**

| Prop         | Type                | Required | Description                                                |
| ------------ | ------------------- | -------- | ---------------------------------------------------------- |
| `customerId` | `string`            | ✅       | The Creem customer ID                                      |
| `portalPath` | `string`            | ❌       | Custom API route path (default: `/portal`)                 |
| `children`   | `ReactNode`         | ❌       | Custom button or link content                              |
| ...linkProps | `HTMLAnchorElement` | ❌       | Any standard anchor tag props (`className`, `style`, etc.) |

---

### Server Functions

#### `Checkout(options)`

Creates a Next.js route handler for checkout sessions.

```typescript
import { Checkout } from "@creem_io/nextjs";

// app/checkout/route.ts
export const GET = Checkout({
  apiKey: process.env.CREEM_API_KEY!,
  testMode: true,
  defaultSuccessUrl: "/success",
});
```

**Options:**

| Option              | Type      | Required | Description                                      |
| ------------------- | --------- | -------- | ------------------------------------------------ |
| `apiKey`            | `string`  | ✅       | Your Creem API key                               |
| `testMode`          | `boolean` | ❌       | Use test environment (default: `false`)          |
| `defaultSuccessUrl` | `string`  | ❌       | Default success URL if not provided in component |

---

#### `Portal(options)`

Creates a Next.js route handler for customer portal sessions.

```typescript
import { Portal } from "@creem_io/nextjs";

// app/portal/route.ts
export const GET = Portal({
  apiKey: process.env.CREEM_API_KEY!,
  testMode: true,
});
```

**Options:**

| Option     | Type      | Required | Description                             |
| ---------- | --------- | -------- | --------------------------------------- |
| `apiKey`   | `string`  | ✅       | Your Creem API key                      |
| `testMode` | `boolean` | ❌       | Use test environment (default: `false`) |

---

#### `Webhook(options)`

Creates a Next.js route handler for processing Creem webhooks with automatic signature verification.

```typescript
import { Webhook } from "@creem_io/nextjs";

// app/api/webhook/creem/route.ts
export const POST = Webhook({
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,

  onCheckoutCompleted: async (data) => {
    // Handle one-time purchases
  },

  onGrantAccess: async (context) => {
    // Grant user access (subscription active/trialing/paid)
  },

  onRevokeAccess: async (context) => {
    // Revoke user access (subscription paused/expired)
  },
});
```

**Options:**

| Option                   | Type       | Required | Description                                          |
| ------------------------ | ---------- | -------- | ---------------------------------------------------- |
| `webhookSecret`          | `string`   | ✅       | Your Creem webhook secret for signature verification |
| `onCheckoutCompleted`    | `function` | ❌       | Called when checkout is completed                    |
| `onRefundCreated`        | `function` | ❌       | Called when refund is created                        |
| `onDisputeCreated`       | `function` | ❌       | Called when dispute is created                       |
| `onSubscriptionActive`   | `function` | ❌       | Called when subscription becomes active              |
| `onSubscriptionTrialing` | `function` | ❌       | Called when subscription is trialing                 |
| `onSubscriptionPaid`     | `function` | ❌       | Called when subscription payment succeeds            |
| `onSubscriptionExpired`  | `function` | ❌       | Called when subscription expires                     |
| `onSubscriptionCanceled` | `function` | ❌       | Called when subscription is canceled                 |
| `onSubscriptionUnpaid`   | `function` | ❌       | Called when subscription payment fails               |
| `onSubscriptionPastDue`  | `function` | ❌       | Called when subscription is past due                 |
| `onSubscriptionPaused`   | `function` | ❌       | Called when subscription is paused                   |
| `onSubscriptionUpdate`   | `function` | ❌       | Called when subscription is updated                  |
| `onGrantAccess`          | `function` | ❌       | Called when user should be granted access            |
| `onRevokeAccess`         | `function` | ❌       | Called when user access should be revoked            |

---

### Access Management

The `onGrantAccess` and `onRevokeAccess` callbacks provide a simple way to manage user access for subscription-based products.

#### `onGrantAccess`

Called when a user should be granted access. This happens when:

- Subscription becomes **active** (after payment)
- Subscription enters **trialing** period (free trial)
- Subscription payment is **paid** (renewal)

```typescript
onGrantAccess: async ({ reason, customer, product, metadata }) => {
  const userId = metadata?.referenceId as string;

  // Grant access in your database
  await db.user.update({
    where: { id: userId },
    data: { subscriptionActive: true },
  });

  console.log(`Granted ${reason} to ${customer.email}`);
};
```

#### `onRevokeAccess`

Called when a user's access should be revoked. This happens when:

- Subscription is **canceled** (after the billing period ends)
- Subscription is **paused** (manually by user or admin)
- Subscription is **expired** (trial ended or subscription period ended)

```typescript
onRevokeAccess: async ({ reason, customer, product, metadata }) => {
  const userId = metadata?.referenceId as string;

  // Revoke access in your database
  await db.user.update({
    where: { id: userId },
    data: { subscriptionActive: false },
  });

  console.log(`Revoked access (${reason}) from ${customer.email}`);
};
```

> **⚠️ Important:** Both callbacks may be called multiple times for the same user/subscription. Always implement these as **idempotent operations** (safe to call repeatedly).

---

### Discount Codes

Apply discount codes to checkouts:

```typescript
<CreemCheckout
  productId="prod_abc123"
  discountCode="LAUNCH50"
  successUrl="/thank-you"
>
  <button>Subscribe with 50% off</button>
</CreemCheckout>
```

---

### Custom Metadata & Reference IDs

Track your internal IDs and custom data:

```typescript
<CreemCheckout
  productId="prod_abc123"
  referenceId={user.id} // Your user ID
  metadata={{
    orderId: generateOrderId(),
    source: "mobile_app",
    campaign: "summer_sale",
    affiliateId: "partner_123",
  }}
  successUrl="/thank-you"
>
  <button>Subscribe Now</button>
</CreemCheckout>
```

Access in webhooks:

```typescript
onCheckoutCompleted: async ({ metadata }) => {
  const { orderId, source, campaign, affiliateId } = metadata;
  // Use your custom data
};
```

---

## Best Practices

### 1. Always Use Environment Variables

Never hardcode API keys or webhook secrets:

```typescript
// ✅ Good
apiKey: process.env.CREEM_API_KEY!;

// ❌ Bad
apiKey: "sk_live_abc123...";
```

### 2. Implement Idempotent Access Management

Access callbacks may be called multiple times. Always make them idempotent:

```typescript
// ✅ Good - idempotent
onGrantAccess: async ({ customer, metadata }) => {
  await db.user.upsert({
    where: { id: metadata.referenceId },
    update: { subscriptionActive: true },
    create: { id: metadata.referenceId, subscriptionActive: true },
  });
};

// ❌ Bad - not idempotent
onGrantAccess: async ({ customer, metadata }) => {
  await db.user.create({
    /* will fail on duplicate calls */
  });
};
```

### 3. Use Reference IDs

Always pass your internal user ID as `referenceId`:

```typescript
<CreemCheckout
  productId="prod_abc123"
  referenceId={session.user.id}
  // ...
/>
```

This allows you to easily map Creem customers to your users in webhooks.

### 4. Test in Test Mode

Always test your integration in test mode first:

```typescript
export const GET = Checkout({
  apiKey: process.env.CREEM_API_KEY!,
  testMode: true, // Test mode
});
```

### 5. Handle Errors Gracefully

Webhook handlers should handle errors and return appropriate responses:

```typescript
onGrantAccess: async (context) => {
  try {
    await grantUserAccess(context);
  } catch (error) {
    console.error("Failed to grant access:", error);
    // Don't throw - webhook will retry
  }
};
```

---

## Webhook Configuration

### Setting Up Webhooks in Creem Dashboard

1. Go to your [Creem Dashboard](https://dashboard.creem.io)
2. Navigate to **Developers** → **Webhooks**
3. Click **Add Endpoint**
4. Enter your webhook URL: `https://yourdomain.com/api/webhook/creem`
5. Select the events you want to receive
6. Copy the **Webhook Secret** to your `.env.local` file

### Testing Webhooks Locally

Use a tool like [ngrok](https://ngrok.com/) to expose your local server:

```bash
ngrok http 3000
```

Then use the ngrok URL in your Creem webhook settings:

```
https://abc123.ngrok.io/api/webhook/creem
```

---

## Common Gotchas

### Event name spelling

Creem uses American English: `subscription.canceled` (one L). Using `cancelled` (two L) will silently drop webhook events — no error is thrown, the handler simply never fires.

### SDK vs webhook field casing

The Creem SDK (`creem` package) returns **camelCase** fields (`currentPeriodEndDate`, `canceledAt`), but `@creem_io/nextjs` webhook callbacks use **snake_case** (`current_period_end_date`, `canceled_at`). Keep this in mind when sharing types or utility functions between SDK calls and webhook handlers.

### Timestamp format

The `created_at` field on webhook events and transactions is a **millisecond timestamp** (number), not an ISO 8601 string. Other date fields like `currentPeriodEndDate` are ISO strings. Parse accordingly:

```typescript
// Webhook created_at — millisecond timestamp
const date = new Date(data.webhookCreatedAt); // number → Date

// Subscription dates — ISO string
const periodEnd = new Date(data.current_period_end_date); // string → Date
```

### Accessing transaction amount in checkouts

The transaction amount is available on the `order` field, not at the top level:

```typescript
onCheckoutCompleted: async (data) => {
  const amount = data.order?.amount;     // e.g. 2900 (cents)
  const currency = data.order?.currency; // e.g. "USD"
  console.log(`Payment: $${amount / 100} ${currency}`);
};
```

### Metadata in access hooks

Both `onGrantAccess` and `onRevokeAccess` receive subscription metadata via the spread `NormalizedSubscriptionEntity`. Access it via `metadata?.referenceId` or any custom keys you passed during checkout:

```typescript
onGrantAccess: async ({ reason, customer, metadata }) => {
  const userId = metadata?.referenceId as string;
  // metadata also includes any custom keys from checkout
};
```

---

## Contributing

We welcome contributions! Please reach out on Discord for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/armitage-labs/creem-nextjs-adaptor.git

# Install dependencies
npm install

# Build the library
npm run build

# Run example app
cd example
npm install
npm run dev
```

---

## Support

- 📧 **Email**: support@creem.io
- 💬 **Discord**: [Join our community](https://discord.gg/q3GKZs92Av)
- 📚 **Documentation**: [docs.creem.io](https://docs.creem.io)

---

## Authors

Built with ❤️ by the [Creem](https://creem.io) team.
