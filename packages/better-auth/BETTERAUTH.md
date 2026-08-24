---
title: Creem
description: Better Auth Plugin for Payment and Subscriptions using Creem
---

[Creem](https://creem.io) is a financial OS that enables teams and individuals selling software globally to split revenue and collaborate on financial workflows without any tax compliance headaches. This plugin integrates Creem with Better Auth, bringing payment processing and subscription management directly into your authentication layer.

<Card href="https://discord.gg/q3GKZs92Av" title="Get support on Creem Discord or in our in-app live-chat" />

## Features

- **Automatic Customer Sync** - Optional synchronization of Creem customer IDs with your users and database
- **Checkout Integration** - Create seamless payment sessions with product-specific checkout flows
- **Customer Portal** - Enable users to manage subscriptions, view invoices, and update payment methods
- **Subscription Management** - Cancel, retrieve, and track subscription details
- **Transaction History** - Search and filter transaction records
- **Webhook Processing** - Handle Creem webhooks with signature verification
- **Database Persistence** - Optional subscription data storage in your database
- **Flexible Architecture** - Use Better Auth endpoints OR direct server-side functions
- **Trial Abuse Prevention** - Users can only get one trial per account across all plans (when using database mode)

## Installation

<Steps>
  <Step>
    ### Install the plugin

    ```package-install
    @creem_io/better-auth
    ```

    <Callout>
      If you're using a separate client and server setup, make sure to install the plugin in both parts of your project.
    </Callout>
  </Step>

  <Step>
    ### Install the Creem SDK

    The Creem SDK is included as a dependency, so you don't need to install it separately.
  </Step>

  <Step>
    ### Get your API Key

    Get your Creem API Key from the [Creem dashboard](https://creem.io/dashboard), under the 'Developers' menu.

    <Callout type="warn">
      Test Mode and Production have different API keys. Make sure you're using the correct one for your environment.
    </Callout>
  </Step>
</Steps>

## Configuration

### Server Configuration

Configure Better Auth with the Creem plugin:

```typescript
import { betterAuth } from "better-auth";
import { creem } from "@creem_io/better-auth";

export const auth = betterAuth({
  database: {
    // your database config
  },
  plugins: [
    creem({
      apiKey: process.env.CREEM_API_KEY!,
      testMode: true, // Use test mode for development
      persistSubscriptions: true, // Enable database persistence (default: true)
      defaultSuccessUrl: "/success",
    }),
  ],
});
```

### Client Configuration

```typescript
import { createAuthClient } from "better-auth/react";
import { creemClient } from "@creem_io/better-auth/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [creemClient()],
});
```

<Callout>
  Standard `createAuthClient` gives you full TypeScript support: endpoint parameters are inferred from the server plugin, and `session.user.creemCustomerId` is properly typed on the client.
</Callout>

### Database Migration

If you're using database persistence (`persistSubscriptions: true`), generate and run the database schema:

```bash
npx @better-auth/cli generate
npx @better-auth/cli migrate
```

<Callout type="info">
  Depending on your database adapter, additional setup steps may be required. Refer to the [Better Auth adapter documentation](https://www.better-auth.com/docs/adapters/mysql) for details.
</Callout>

### Webhook Setup

<Steps>
  <Step>
    ### Create Webhook Endpoint

    In your Creem dashboard, create a webhook endpoint pointing to:

    ```
    https://your-domain.com/api/auth/creem/webhook
    ```

    (`/api/auth` is the default Better Auth server path)
  </Step>

  <Step>
    ### Configure Webhook Secret

    Copy the webhook signing secret from Creem and add it to your environment:

    ```env
    CREEM_WEBHOOK_SECRET=your_webhook_secret_here
    ```

    Update your server configuration:

    ```typescript
    creem({
      apiKey: process.env.CREEM_API_KEY!,
      webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
      testMode: true,
    })
    ```
  </Step>

  <Step>
    ### Local Development (Optional)

    For local testing, use ngrok to expose your local server:

    ```bash
    ngrok http 3000
    ```

    Add the ngrok URL to your Creem webhook settings.
  </Step>
</Steps>

## Database Schema

When `persistSubscriptions: true`, the plugin creates the following schema:

### Subscription Table

| Field                 | Type    | Description                      |
| --------------------- | ------- | -------------------------------- |
| `id`                  | string  | Primary key                      |
| `productId`           | string  | Creem product ID                 |
| `referenceId`         | string  | Your user/organization ID        |
| `creemCustomerId`     | string  | Creem customer ID                |
| `creemSubscriptionId` | string  | Creem subscription ID            |
| `creemOrderId`        | string  | Creem order ID                   |
| `status`              | string  | Subscription status              |
| `periodStart`         | date    | Billing period start date        |
| `periodEnd`           | date    | Billing period end date          |
| `cancelAtPeriodEnd`   | boolean | Whether subscription will cancel |

### User Table Extension

| Field             | Type   | Description                  |
| ----------------- | ------ | ---------------------------- |
| `creemCustomerId` | string | Links user to Creem customer |

## Usage

### Checkout

Create a checkout session to process payments:

```typescript
"use client";

import { authClient } from "@/lib/auth-client";

export function SubscribeButton({ productId }: { productId: string }) {
  const handleCheckout = async () => {
    // Navigation is not automatic (redirect defaults to false)
    const { data, error } = await authClient.creem.createCheckout({
      productId,
      successUrl: "/dashboard",
      discountCode: "LAUNCH50", // Optional
      metadata: { planType: "pro" }, // Optional
    });

    if (data?.url) {
      window.location.href = data.url;
    }
  };

  return <button onClick={handleCheckout}>Subscribe Now</button>;
}
```

To let better-auth redirect to the checkout URL automatically, opt in with `redirect: true`:

```typescript
await authClient.creem.createCheckout({ productId, redirect: true });
```

#### Checkout Options

- `productId` (required) - The Creem product ID
- `units` - Number of units (default: 1)
- `successUrl` - Redirect URL after successful payment
- `discountCode` - Discount code to apply
- `customer` - Customer information (auto-populated from session)
- `metadata` - Additional metadata (auto-includes user ID as `referenceId`)
- `requestId` - Idempotency key for duplicate prevention
- `redirect` - Whether the client should redirect to the checkout URL automatically (default: `false`; set `true` to redirect automatically)

### Customer Portal

Redirect users to manage their subscriptions:

```typescript
// Navigation is not automatic (redirect defaults to false)
const handlePortal = async () => {
  const { data } = await authClient.creem.createPortal();

  if (data?.url) {
    window.location.href = data.url;
  }
};
```

Or let better-auth redirect automatically:

```typescript
await authClient.creem.createPortal({ redirect: true });
```

### Subscription Management

#### Cancel Subscription

When database persistence is enabled, the subscription is found automatically for the authenticated user:

```typescript
const handleCancel = async () => {
  const { data, error } = await authClient.creem.cancelSubscription();

  if (data?.success) {
    console.log(data.message);
  }
};
```

If database persistence is disabled, provide the subscription ID:

```typescript
const { data } = await authClient.creem.cancelSubscription({
  id: "sub_123456",
});
```

#### Retrieve Subscription

Get subscription details for the authenticated user:

```typescript
const getSubscription = async () => {
  const { data } = await authClient.creem.retrieveSubscription();

  if (data) {
    console.log(`Status: ${data.status}`);
    console.log(`Product: ${data.product.name}`);
    console.log(`Price: ${data.product.price} ${data.product.currency}`);
  }
};
```

#### Check Access

Verify if the user has an active subscription (requires database mode):

```typescript
const { data } = await authClient.creem.hasAccessGranted();

if (data?.hasAccessGranted) {
  // User has active subscription access
  console.log(`Period end: ${data.subscription?.periodEnd}`);
}
```

<Callout type="info">
  This function checks if the user has access for the current billing period. For example, if a user purchases a yearly plan and cancels after one month, they still have access until the year ends.
</Callout>

### Transaction History

Search transaction records for the authenticated user:

```typescript
const { data } = await authClient.creem.searchTransactions({
  productId: "prod_xyz789", // Optional filter
  pageNumber: 1,
  pageSize: 50,
});

if (data?.transactions) {
  data.transactions.forEach((tx) => {
    console.log(`${tx.type}: ${tx.amount} ${tx.currency}`);
  });
}
```

## Server-Side Functions

Use these utilities directly in Server Components, Server Actions, or API routes without going through Better Auth endpoints.

### Import Server Utilities

```typescript
import {
  createCheckout,
  createPortal,
  cancelSubscription,
  retrieveSubscription,
  searchTransactions,
  checkSubscriptionAccess,
  isActiveSubscription,
  formatCreemDate,
  getDaysUntilRenewal,
  validateWebhookSignature,
} from "@creem_io/better-auth/server";
```

### Server Component Example

```typescript
import { checkSubscriptionAccess } from "@creem_io/better-auth/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  const status = await checkSubscriptionAccess(
    {
      apiKey: process.env.CREEM_API_KEY!,
      testMode: true,
    },
    {
      database: auth.options.database,
      userId: session.user.id,
    }
  );

  if (!status.hasAccess) {
    redirect("/subscribe");
  }

  return (
    <div>
      <h1>Welcome to Dashboard</h1>
      <p>Subscription Status: {status.status}</p>
      {status.expiresAt && (
        <p>Renews: {status.expiresAt.toLocaleDateString()}</p>
      )}
    </div>
  );
}
```

### Server Action Example

```typescript
"use server";

import { createCheckout } from "@creem_io/better-auth/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function startCheckout(productId: string) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  const { url } = await createCheckout(
    {
      apiKey: process.env.CREEM_API_KEY!,
      testMode: true,
    },
    {
      productId,
      customer: { email: session.user.email },
      successUrl: "/success",
      metadata: { userId: session.user.id },
    }
  );

  redirect(url);
}
```

### Middleware Example

Protect routes based on subscription status:

```typescript
import { checkSubscriptionAccess } from "@creem_io/better-auth/server";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const status = await checkSubscriptionAccess(
    {
      apiKey: process.env.CREEM_API_KEY!,
      testMode: true,
    },
    {
      database: auth.options.database,
      userId: session.user.id,
    }
  );

  if (!status.hasAccess) {
    return NextResponse.redirect(new URL("/subscribe", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

### Utility Functions

```typescript
import {
  isActiveSubscription,
  formatCreemDate,
  getDaysUntilRenewal,
} from "@creem_io/better-auth/server";

// Check if status grants access
if (isActiveSubscription(subscription.status)) {
  // User has access
}

// Format Creem timestamps
const renewalDate = formatCreemDate(subscription.next_billing_date);
console.log(renewalDate.toLocaleDateString());

// Calculate days until renewal
const days = getDaysUntilRenewal(subscription.current_period_end_date);
console.log(`Renews in ${days} days`);
```

## Webhook Handling

The plugin provides flexible webhook handling with both granular event handlers and high-level access control handlers.

### Event-Specific Handlers

Handle individual webhook events with all properties flattened for easy access:

```typescript
creem({
  apiKey: process.env.CREEM_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,

  onCheckoutCompleted: async (data) => {
    const { customer, product, order, webhookEventType } = data;
    console.log(`${customer.email} purchased ${product.name}`);
    
    // Perfect for one-time payments
    await sendThankYouEmail(customer.email);
  },

  onSubscriptionActive: async (data) => {
    const { customer, product, status } = data;
    // Handle active subscription
  },

  onSubscriptionTrialing: async (data) => {
    // Handle trial period
  },

  onSubscriptionCanceled: async (data) => {
    // Handle cancellation
  },

  onSubscriptionExpired: async (data) => {
    // Handle expiration
  },

  onRefundCreated: async (data) => {
    // Handle refunds
  },

  onDisputeCreated: async (data) => {
    // Handle disputes
  },
});
```

### Access Control Handlers (Recommended)

Use high-level handlers for simpler subscription access management that takes current billing periods into consideration:

```typescript
creem({
  apiKey: process.env.CREEM_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,

  // Triggered for: active, trialing, and paid subscriptions
  onGrantAccess: async ({ reason, product, customer, metadata }) => {
    const userId = metadata?.referenceId as string;

    await db.user.update({
      where: { id: userId },
      data: { 
        hasAccess: true, 
        subscriptionTier: product.name,
        accessReason: reason 
      },
    });

    console.log(`Granted ${reason} access to ${customer.email}`);
  },

  // Triggered for: paused, expired, and canceled subscriptions considering current date and billing period end
  onRevokeAccess: async ({ reason, product, customer, metadata }) => {
    const userId = metadata?.referenceId as string;

    await db.user.update({
      where: { id: userId },
      data: { 
        hasAccess: false, 
        revokeReason: reason 
      },
    });

    console.log(`Revoked access (${reason}) from ${customer.email}`);
  },
});
```

#### Grant Access Reasons

- `subscription_active` - Subscription is active
- `subscription_trialing` - Subscription is in trial period
- `subscription_paid` - Subscription payment received

#### Revoke Access Reasons

- `subscription_paused` - Subscription paused by user or admin
- `subscription_expired` - Subscription expired without renewal

### Custom Webhook Handler

Create your own webhook endpoint with signature verification:

```typescript
// app/api/webhooks/custom/route.ts
import { validateWebhookSignature } from "@creem_io/better-auth/server";

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("creem-signature");

  if (
    !(await validateWebhookSignature(
      payload,
      signature,
      process.env.CREEM_WEBHOOK_SECRET!
    ))
  ) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(payload);
  // Your custom webhook handling logic

  return Response.json({ received: true });
}
```

## Configuration Options

### Main Options

```typescript
interface CreemOptions {
  /** Creem API key (required) */
  apiKey: string;

  /** Webhook secret for signature verification */
  webhookSecret?: string;

  /** Use test mode (default: false) */
  testMode?: boolean;

  /** Default success URL for checkouts */
  defaultSuccessUrl?: string;

  /** Persist subscription data to database (default: true) */
  persistSubscriptions?: boolean;

  // Event-Specific Webhook Handlers
  // Each callback receives the better-auth GenericEndpointContext as its second argument
  onCheckoutCompleted?: (
    data: FlatCheckoutCompleted,
    betterAuthContext: GenericEndpointContext,
  ) => void | Promise<void>;
  onRefundCreated?: (
    data: FlatRefundCreated,
    betterAuthContext: GenericEndpointContext,
  ) => void | Promise<void>;
  onDisputeCreated?: (
    data: FlatDisputeCreated,
    betterAuthContext: GenericEndpointContext,
  ) => void | Promise<void>;
  onSubscriptionActive?: (
    data: FlatSubscriptionEvent,
    betterAuthContext: GenericEndpointContext,
  ) => void | Promise<void>;
  onSubscriptionTrialing?: (
    data: FlatSubscriptionEvent,
    betterAuthContext: GenericEndpointContext,
  ) => void | Promise<void>;
  onSubscriptionCanceled?: (
    data: FlatSubscriptionEvent,
    betterAuthContext: GenericEndpointContext,
  ) => void | Promise<void>;
  onSubscriptionPaid?: (
    data: FlatSubscriptionEvent,
    betterAuthContext: GenericEndpointContext,
  ) => void | Promise<void>;
  onSubscriptionExpired?: (
    data: FlatSubscriptionEvent,
    betterAuthContext: GenericEndpointContext,
  ) => void | Promise<void>;
  onSubscriptionUnpaid?: (
    data: FlatSubscriptionEvent,
    betterAuthContext: GenericEndpointContext,
  ) => void | Promise<void>;
  onSubscriptionUpdate?: (
    data: FlatSubscriptionEvent,
    betterAuthContext: GenericEndpointContext,
  ) => void | Promise<void>;
  onSubscriptionPastDue?: (
    data: FlatSubscriptionEvent,
    betterAuthContext: GenericEndpointContext,
  ) => void | Promise<void>;
  onSubscriptionPaused?: (
    data: FlatSubscriptionEvent,
    betterAuthContext: GenericEndpointContext,
  ) => void | Promise<void>;

  // Access Control Handlers (High-level)
  onGrantAccess?: (
    context: GrantAccessContext,
    betterAuthContext: GenericEndpointContext,
  ) => void | Promise<void>;
  onRevokeAccess?: (
    context: RevokeAccessContext,
    betterAuthContext: GenericEndpointContext,
  ) => void | Promise<void>;
}
```

### Database Mode vs API Mode

The plugin supports two operational modes:

#### Database Mode (Recommended)

When `persistSubscriptions: true` (default), subscription data is stored in your database.

**Benefits:**
- Fast access checks without API calls
- Offline access to subscription data
- Query subscriptions with SQL
- Automatic synchronization via webhooks
- Trial abuse prevention

**Usage:**

```typescript
creem({
  apiKey: process.env.CREEM_API_KEY!,
  persistSubscriptions: true, // Default
})
```

#### API Mode

When `persistSubscriptions: false`, all data comes directly from the Creem API.

**Benefits:**
- No database schema required
- Simpler initial setup

**Limitations:**
- Requires API call for each access check
- Some features require custom implementation
- No built-in trial abuse prevention

**Usage:**

```typescript
creem({
  apiKey: process.env.CREEM_API_KEY!,
  persistSubscriptions: false,
})
```

<Callout type="warn">
  In API mode, functions like `checkSubscriptionAccess` and `hasAccessGranted` have limited functionality and may require custom implementation using the Creem SDK directly.
</Callout>

## Type Exports

### Server-Side Types

```typescript
import type {
  CreemOptions,
  GrantAccessContext,
  RevokeAccessContext,
  GrantAccessReason,
  RevokeAccessReason,
  FlatCheckoutCompleted,
  FlatRefundCreated,
  FlatDisputeCreated,
  FlatSubscriptionEvent,
} from "@creem_io/better-auth";
```

### Client-Side Types

```typescript
import type {
  CreateCheckoutInput,
  CreateCheckoutResponse,
  CheckoutCustomer,
  CreatePortalInput,
  CreatePortalResponse,
  CancelSubscriptionInput,
  CancelSubscriptionResponse,
  RetrieveSubscriptionInput,
  SubscriptionData,
  SearchTransactionsInput,
  SearchTransactionsResponse,
  TransactionData,
  HasAccessGrantedResponse,
} from "@creem_io/better-auth";
```

### Server Utility Types

```typescript
import type { CreemServerConfig } from "@creem_io/better-auth/server";
```

## Trial Abuse Prevention

When using database mode (`persistSubscriptions: true`), the plugin automatically prevents trial abuse. Users can only receive one trial across all subscription plans.

**Example Scenario:**
1. User subscribes to "Starter" plan with 7-day trial
2. User cancels subscription during the trial period
3. User attempts to subscribe to "Premium" plan
4. No trial is offered - user is charged immediately

This protection is automatic and requires no configuration. Trial eligibility is determined when the subscription is created and cannot be overridden.

## Environment Variables

```env
# Required
CREEM_API_KEY=your_api_key_here

# Recommended (for webhooks)
CREEM_WEBHOOK_SECRET=your_webhook_secret_here
```

## Troubleshooting

### Webhook Issues

If webhooks aren't being processed correctly:

1. Verify the webhook URL is correct in your Creem dashboard
2. Check that the webhook signing secret matches
3. Ensure all necessary events are selected in the Creem dashboard
4. Review server logs for webhook processing errors
5. Test webhook delivery using Creem's webhook testing tool

### Subscription Status Issues

If subscription statuses aren't updating:

1. Confirm webhooks are being received and processed
2. Verify `creemCustomerId` and `creemSubscriptionId` fields are populated
3. Check that reference IDs match between your application and Creem
4. Review webhook handler logs for errors

### Database Mode Not Working

If database persistence isn't functioning:

1. Ensure `persistSubscriptions: true` is set (it's the default)
2. Run migrations: `npx @better-auth/cli migrate`
3. Verify database connection is working
4. Check that schema tables were created successfully
5. Review database adapter configuration

### Testing Webhooks Locally

For local development, use ngrok to forward webhooks:

```bash
ngrok http 3000

# Use the ngrok URL in Creem dashboard:
# https://abc123.ngrok.io/api/auth/creem/webhook
```

### API Mode Limitations

Some features require database mode:

- `checkSubscriptionAccess` with `userId` parameter
- `getActiveSubscriptions` with `userId` parameter  
- Automatic trial abuse prevention
- `hasAccessGranted` client method

To use these features, either enable database mode or implement custom logic using the Creem SDK directly.

## Additional Resources

- [Creem Documentation](https://docs.creem.io)
- [Creem Dashboard](https://creem.io/dashboard)
- [Better Auth Documentation](https://better-auth.com)
- [Plugin GitHub Repository Additional Documentation](https://github.com/armitage-labs/creem-betterauth)

## Support

For issues or questions:

- Open an issue on [GitHub](https://github.com/armitage-labs/creem-betterauth/issues)
- Contact Creem support at [support@creem.io](mailto:support@creem.io)
- Join our [Discord community](https://discord.gg/q3GKZs92Av) for real-time support and discussion.
- Chat with us directly using the in-app live chat on the [Creem dashboard](https://creem.io/dashboard).

