# @creem_io/better-auth

Official Creem Better-Auth plugin for seamless payments and subscription management.

## ✨ Features

- 🔐 **Automatic Customer Sync** - Optional automatic synchronization of the creem customer_id with your user_id
- **Checkout Sessions** - Create payment sessions with product-specific checkout
- 📊 **Customer Portal** - Let users manage their subscriptions, view invoices, and update payment methods
- 🔄 **Subscription Management** - Cancel, retrieve, and track subscription details
- 💰 **Transaction History** - Search and filter transaction records
- 🪝 **Webhook Processing** - Handle Creem webhooks with signature verification
- 💾 **Database Persistence** - Optional subscription data storage in your database
- ⚡ **Flexible Architecture** - Use Better-Auth endpoints OR direct server-side functions

## 📦 Installation

```bash
npm install @creem_io/better-auth better-auth creem
```

### Required Dependencies

- `better-auth` ^1.3.34 (peer dependency)
- `creem` ^1.3.6 (included)
- `zod` ^3.23.8 (included)

## 🚀 Quick Start

### Required setup

Get your Creem API Key from the dashboard, under the 'Developers' menu.
Ensure you are using the api-key from the correct environment:
Important: Test-Mode have different API-Keys than Production.

### Server Setup

Create your Better Auth configuration with the Creem plugin:

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { creem } from "@creem_io/better-auth";

export const auth = betterAuth({
  database: {
    // your database config
  },
  plugins: [
    creem({
      apiKey: process.env.CREEM_API_KEY,
      testMode: true, // Use test mode for development
    }),
  ],
});
```

<details>
<summary>Optional: Add your webhook secret to securely receive and verify webhooks from Creem</summary>
  
Note: Webhooks are only enabled if you provide a valid webhook secret.

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { creem } from "@creem_io/better-auth";

export const auth = betterAuth({
  database: {
    // your database config
  },
  plugins: [
    creem({
      apiKey: process.env.CREEM_API_KEY,
      webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
      testMode: true, // Use test mode for development
    }),
  ],
});
```
</details>


<details>
<summary><strong>Recommended: Enable <code>persistSubscriptions</code> for automatic database sync</strong></summary>

Using <code>persistSubscriptions</code> automatically synchronizes your subscription data with your database.  
Read more about the database schema that Creem creates in your application automatically below.

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { creem } from "@creem_io/better-auth";

export const auth = betterAuth({
  database: {
    // your database config
  },
  plugins: [
    creem({
      apiKey: process.env.CREEM_API_KEY!,
      webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
      testMode: true, // Use test mode for development
      defaultSuccessUrl: "/success",
      persistSubscriptions: true, // Enable database persistence (default: true)
    }),
  ],
});
```
</details>



<details>
<summary><strong>Optional: Add webhook handlers to run your own logic when certain events occur</strong></summary>

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { creem } from "@creem_io/better-auth";

export const auth = betterAuth({
  database: {
    // your database config
  },
  plugins: [
    creem({
      apiKey: process.env.CREEM_API_KEY!,
      webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
      testMode: true, // Use test mode for development
      defaultSuccessUrl: "/success",
      persistSubscriptions: true, // Enable database persistence (default: true)

      // Optional: Webhook handlers
      onGrantAccess: async ({ customer, product, metadata, reason }) => {
        const userId = metadata?.referenceId as string;
        console.log(`Granting access (${reason}) to ${customer.email}`);
        // Update your database to grant access
      },

      onRevokeAccess: async ({ customer, product, metadata, reason }) => {
        const userId = metadata?.referenceId as string;
        console.log(`Revoking access (${reason}) from ${customer.email}`);
        // Update your database to revoke access
      },
    }),
  ],
});
```
</details>



<details>
<summary><strong>Optional: Set a default success URL to redirect your customers after checkout</strong></summary>

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { creem } from "@creem_io/better-auth";

export const auth = betterAuth({
  database: {
    // your database config
  },
  plugins: [
    creem({
      apiKey: process.env.CREEM_API_KEY!,
      webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
      testMode: true, // Use test mode for development
      defaultSuccessUrl: "/success",
    }),
  ],
});
```
</details>

### Client Setup (Option 1: Standard)

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { creemClient } from "@creem_io/better-auth/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [creemClient()],
});
```

### Client Setup (Option 2: Improved TypeScript Support for React)

For even better TypeScript support with cleaner IntelliSense:

```typescript
// lib/auth-client.ts
import { createCreemAuthClient } from "@creem_io/better-auth/create-creem-auth-client";
import { creemClient } from "@creem_io/better-auth/client";

export const authClient = createCreemAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [creemClient()],
});

// Now you get the cleanest possible type hints!
```

The `createCreemAuthClient` wrapper improves TypeScript parameter types and autocomplete. Note: It is primarily designed for use with the Creem plugin and may not support all other better-auth plugins. If you encounter any issues, please open an issue or pull request at https://github.com/armitage-labs/creem-betterauth.

### Migrate the Database

If you’re using database persistence (`persistSubscriptions: true`), generate the database schema:

```bash
npx @better-auth/cli generate
```

Or run migrations:

```bash
npx @better-auth/cli migrate
```

See the [Schema](#schema) section for manual setup.
Depending on your database adapter, additional setup steps may be required.
Refer to the BetterAuth documentation for adapter-specific instructions: https://www.better-auth.com/docs/adapters/mysql

### Set Up Webhooks

1. Create a webhook endpoint in your Creem dashboard pointing to:

```
https://your-domain.com/api/auth/creem/webhook
```

(`/api/auth` is the default path for the Better Auth server)

2. Copy the webhook signing secret and set it in your `.env` file as `CREEM_WEBHOOK_SECRET`.

3. (Optional) For local development and testing, use a tool like ngrok to expose your local server. Add the public ngrok URL to your Creem dashboard webhook settings.

## 💻 Usage

### Client-Side (Better Auth Endpoints)

#### Create Checkout

Create a checkout session for a product. The plugin automatically attaches the authenticated user's email.

```typescript
"use client";

import { authClient } from "@/lib/auth-client";
import type { CreateCheckoutInput } from "@creem_io/better-auth";

export function SubscribeButton({ productId }: { productId: string }) {
  const handleCheckout = async () => {
    const { data, error } = await authClient.creem.createCheckout({
      productId, // Required
    });

    if (data?.url) {
      //Redirect user to checkout
      window.location.href = data.url;
    }
  };

  return <button onClick={handleCheckout}>Subscribe Now</button>;
}
```

You can also access advanced checkout features directly through the endpoint:

```typescript
"use client";

import { authClient } from "@/lib/auth-client";
import type { CreateCheckoutInput } from "@creem_io/better-auth";

export function SubscribeButton({ productId }: { productId: string }) {
  const handleCheckout = async () => {
    const { data, error } = await authClient.creem.createCheckout({
      productId, // Required
      units: 1, // Optional, defaults to 1
      successUrl: "/pro-plan/thank-you", // Optional
      discountCode: "SUMMER2024", // Optional
      metadata: { foo: "bar", icecream: "smooth" } // Optional: Arbitrary key-value pair you can set from your application
    });

    if (data?.url) {
      window.location.href = data.url;
    }
  };

  return <button onClick={handleCheckout}>Subscribe Now</button>;
}
```

**Parameters:**

- `productId` (required) - The Creem product ID
- `units` - Number of units (default: 1)
- `successUrl` - Success redirect URL
- `discountCode` - Discount code to apply
- `customer` - Customer info (defaults to session user)
- `metadata` - Additional metadata (auto-includes user ID as `referenceId`)
- `requestId` - Idempotency key

#### Create Customer Portal

Open the Creem customer portal where users can manage subscriptions (Uses logged-in user):

```typescript
const handlePortal = async () => {
  const { data, error } = await authClient.creem.createPortal();

  if (data?.url) {
    window.location.href = data.url;
  }
};
```

#### Cancel Subscription

If database persistence is enabled, the subscription for the logged-in user is found automatically.
Otherwise, you must provide the subscription ID in the request.

```typescript
const handleCancel = async (subscriptionId: string) => {
  const { data, error } = await authClient.creem.cancelSubscription({
    id: subscriptionId,
  });

  if (data?.success) {
    console.log(data.message);
  }
};
```

#### Retrieve Subscription

If database persistence is enabled, the subscription will be retrieved automatically for the logged-in user. Otherwise, you must provide the subscription ID in the request.

```typescript
const getSubscription = async (subscriptionId: string) => {
  const { data } = await authClient.creem.retrieveSubscription({
    id: subscriptionId,
  });

  if (data) {
    console.log(`Status: ${data.status}`);
    console.log(`Product: ${data.product.name}`);
    console.log(`Price: ${data.product.price} ${data.product.currency}`);
  }
};
```

#### Search Transactions
By default, uses the logged-in user's creemCustomerId. If not available, it will use the customerId provided in the request body.

```typescript
const { data } = await authClient.creem.searchTransactions({
  customerId: "cust_abc123", // Optional
  productId: "prod_xyz789", // Optional
  pageNumber: 1, // Optional
  pageSize: 50, // Optional
});

if (data?.transactions) {
  data.transactions.forEach((tx) => {
    console.log(`${tx.type}: ${tx.amount} ${tx.currency}`);
  });
}
```

#### Check Access
Check whether the currently logged-in user has an active subscription for the current period. This function requires database persistence to be enabled.

For example, if a user purchases a yearly plan and cancels after one month, this function will still return true as long as the current date is within the active subscription period that was paid for.

```typescript
const { data } = await authClient.creem.hasAccessGranted();

if (data?.hasAccessGranted) {
  // User has active subscription
}
```

### 🖥️ Server-Side Utilities

Use these functions directly in Server Components, Server Actions, or API routes **without** going through Better Auth endpoints.
These functions can be used independently from your plugin configuration. You may specify different options, such as a separate API key or test mode, when calling them.

#### Import Server Utilities

```typescript
import {
  createCreemClient,
  createCheckout,
  createPortal,
  cancelSubscription,
  retrieveSubscription,
  searchTransactions,
  checkSubscriptionAccess,
  getActiveSubscriptions,
  isActiveSubscription,
  formatCreemDate,
  getDaysUntilRenewal,
  validateWebhookSignature,
} from "@creem_io/better-auth/server";
```

#### Server Component Example

```typescript
// app/dashboard/page.tsx
import { checkSubscriptionAccess } from "@creem_io/better-auth/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/login');
  }

  // Database mode (when persistSubscriptions: true)
  const status = await checkSubscriptionAccess(
    {
      apiKey: process.env.CREEM_API_KEY!,
      testMode: true
    },
    {
      database: auth.options.database,
      userId: session.user.id
    }
  );

  if (!status.hasAccess) {
    redirect('/subscribe');
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Status: {status.status}</p>
      {status.expiresAt && (
        <p>Renews: {status.expiresAt.toLocaleDateString()}</p>
      )}
    </div>
  );
}
```

#### Server Action Example

```typescript
// app/actions.ts
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
    },
  );

  redirect(url);
}
```

#### Middleware Example

```typescript
// middleware.ts
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
    },
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

#### Utility Functions

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

#### Custom Webhook Handler

```typescript
// app/api/webhooks/custom/route.ts
import { validateWebhookSignature } from "@creem_io/better-auth/server";

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("creem-signature");

  if (
    !validateWebhookSignature(
      payload,
      signature,
      process.env.CREEM_WEBHOOK_SECRET!,
    )
  ) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(payload);
  // Custom webhook handling logic

  return Response.json({ received: true });
}
```

## 🔄 Database Mode vs API Mode

The plugin supports two operational modes:

### Database Mode (Recommended)

When `persistSubscriptions: true` (default), subscription data is stored in your database.

**Benefits:**

- ✅ Fast access checks (no API calls)
- ✅ Offline access to subscription data
- ✅ Query subscriptions with SQL
- ✅ Automatic sync via webhooks

**Usage:**

```typescript
// lib/auth.ts
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
    }),
  ],
});
```

## 📊 Schema

When `persistSubscriptions: true`, the plugin creates these database tables:

### `subscription` Table

| Field                 | Type    | Description           |
| --------------------- | ------- | --------------------- |
| `id`                  | string  | Primary key           |
| `productId`           | string  | Creem product ID      |
| `referenceId`         | string  | Your user/org ID      |
| `creemCustomerId`     | string  | Creem customer ID     |
| `creemSubscriptionId` | string  | Creem subscription ID |
| `creemOrderId`        | string  | Creem order ID        |
| `status`              | string  | Subscription status   |
| `periodStart`         | date    | Period start date     |
| `periodEnd`           | date    | Period end date       |
| `cancelAtPeriodEnd`   | boolean | Cancel flag           |

### `user` Table Extension

| Field             | Type    | Description                           |
| ----------------- | ------- | ------------------------------------- |
| `creemCustomerId` | string  | Links user to Creem customer          |
| `hadTrial`        | boolean | Whether user has used a trial period  |


### API Mode

When `persistSubscriptions: false`, all data comes directly from Creem API.

**Benefits:**

- ✅ No database schema needed
- ✅ Simpler setup

**Limitations:**

- ⚠️ Requires API call for each check
- ⚠️ Some features require custom implementation

**Usage:**


```typescript
// lib/auth.ts
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
      persistSubscriptions: false, // Disable database persistence
    }),
  ],
});
```

**Note:** In API mode, some functions like `checkSubscriptionAccess` and `getActiveSubscriptions` have limited functionality and may require custom implementation with the Creem SDK.

## 🪝 Webhook Handling

The plugin provides two types of webhook handlers:

### 1. Event-Specific Handlers

Handle specific webhook events with all properties flattened:

```typescript
creem({
  apiKey: process.env.CREEM_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,

  onCheckoutCompleted: async (data) => {
    const {
      webhookEventType, // "checkout.completed"
      webhookId,
      product,
      customer,
      order,
      subscription,
    } = data;

    console.log(`${customer.email} purchased ${product.name}`);
  },

  onSubscriptionActive: async (data) => {
    const { product, customer, status } = data;
    // Handle active subscription
  },
});
```

### 2. Access Control Handlers (Recommended)

Use high-level `onGrantAccess` and `onRevokeAccess` for simpler access management:

```typescript
creem({
  apiKey: process.env.CREEM_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,

  // Triggered for: active, trialing, and paid subscriptions
  onGrantAccess: async ({ reason, product, customer, metadata }) => {
    const userId = metadata?.referenceId as string;

    await db.user.update({
      where: { id: userId },
      data: { hasAccess: true, subscriptionStatus: reason },
    });

    console.log(`Granted ${reason} to ${customer.email}`);
  },

  // Triggered for: paused, expired, and canceled subscriptions considering current date and billing period end
  onRevokeAccess: async ({ reason, product, customer, metadata }) => {
    const userId = metadata?.referenceId as string;

    await db.user.update({
      where: { id: userId },
      data: { hasAccess: false, subscriptionStatus: reason },
    });

    console.log(`Revoked access (${reason}) from ${customer.email}`);
  },
});
```

**Grant Reasons:**

- `subscription_active` - Subscription is active
- `subscription_trialing` - Subscription is in trial
- `subscription_paid` - Subscription payment received

**Revoke Reasons:**

- `subscription_paused` - Subscription paused
- `subscription_expired` - Subscription expired

## ⚙️ Configuration Options

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

  // Webhook Handlers
  onCheckoutCompleted?: (data: FlatCheckoutCompleted) => void; // Great for One Time Payments
  onRefundCreated?: (data: FlatRefundCreated) => void;
  onDisputeCreated?: (data: FlatDisputeCreated) => void;
  onSubscriptionActive?: (
    data: FlatSubscriptionEvent<"subscription.active">,
  ) => void;
  onSubscriptionTrialing?: (
    data: FlatSubscriptionEvent<"subscription.trialing">,
  ) => void;
  onSubscriptionCanceled?: (
    data: FlatSubscriptionEvent<"subscription.canceled">,
  ) => void;
  onSubscriptionPaid?: (
    data: FlatSubscriptionEvent<"subscription.paid">,
  ) => void;
  onSubscriptionExpired?: (
    data: FlatSubscriptionEvent<"subscription.expired">,
  ) => void;
  onSubscriptionUnpaid?: (
    data: FlatSubscriptionEvent<"subscription.unpaid">,
  ) => void;
  onSubscriptionUpdate?: (
    data: FlatSubscriptionEvent<"subscription.update">,
  ) => void;
  onSubscriptionPastDue?: (
    data: FlatSubscriptionEvent<"subscription.past_due">,
  ) => void;
  onSubscriptionPaused?: (
    data: FlatSubscriptionEvent<"subscription.paused">,
  ) => void;

  // Access Control (High-level)
  onGrantAccess?: (context: GrantAccessContext) => void | Promise<void>;
  onRevokeAccess?: (context: RevokeAccessContext) => void | Promise<void>;
}
```

## 📚 Type Exports

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

## 🎯 TypeScript Tips

1. **Hover for Documentation** - Hover over any method to see full JSDoc documentation
2. **Autocomplete** - Let TypeScript suggest available options
3. **Type Inference** - Response types are automatically inferred
4. **Import Types** - Import types explicitly when needed for function parameters

## 🌍 Environment Variables

```env
# Required
CREEM_API_KEY=your_api_key_here

# Optional
CREEM_WEBHOOK_SECRET=your_webhook_secret_here
```

## 🐛 Debug Logging

The plugin uses Better Auth's built-in logger with the `[creem]` prefix for all log messages. To enable debug-level logging, set the `logger.level` option in your Better Auth configuration:

```typescript
export const auth = betterAuth({
  database: {
    // your database config
  },
  logger: {
    level: "debug", // Enable debug logging
  },
  plugins: [
    creem({
      apiKey: process.env.CREEM_API_KEY!,
      webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
      persistSubscriptions: true,
    }),
  ],
});
```

**Log levels:**

| Level   | What it shows                                                              |
| ------- | -------------------------------------------------------------------------- |
| `error` | Failures in webhook processing, subscription updates, and API calls        |
| `warn`  | Missing configuration (API key, referenceId), user not found               |
| `info`  | Successful operations (subscription created/updated, user linked, access changes) |
| `debug` | Detailed flow tracing (subscription lookups, access check decisions)        |

All log messages are prefixed with `[creem]` so you can easily filter them:

```bash
# Filter creem logs in your application output
your-app 2>&1 | grep "\[creem\]"
```

## 🔧 Troubleshooting

### Webhook Issues

- Check webhook URL is correct in Creem dashboard
- Verify webhook signing secret matches
- Ensure all necessary events are selected
- Check server logs for errors

### Subscription Status Issues

- Make sure webhooks are being received
- Check `creemCustomerId` and `creemSubscriptionId` fields are populated
- Verify reference IDs match between app and Creem

### Testing Webhooks Locally

Use a tool like ngrok:

```bash
# Using ngrok
ngrok http 3000

# Then use the ngrok URL in Creem dashboard:
# https://abc123.ngrok.io/api/auth/creem/webhook
```

### Database Mode Not Working

- Ensure `persistSubscriptions: true` (default)
- Run migrations: `npx @better-auth/cli migrate`
- Check database connection
- Verify schema tables exist

### API Mode Limitations

Some functions require database mode:

- `checkSubscriptionAccess` with `userId`
- `getActiveSubscriptions` with `userId`

Either enable database mode or implement custom logic with the Creem SDK directly.

## 📖 Additional Resources

- [Creem Documentation](https://docs.creem.io)
- [Better-Auth Documentation](https://better-auth.com)
- [GitHub Repository](https://github.com/armitage-labs/creem-betterauth)

## 📄 License

MIT

## 🤝 Support

For issues or questions:

- Open an issue on [GitHub](https://github.com/armitage-labs/creem-betterauth/issues)
- Contact Creem support at [support@creem.io](mailto:support@creem.io)
