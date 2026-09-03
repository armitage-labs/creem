# Quick Start Guide

## Installation

```bash
npm install @creem_io/better-auth better-auth creem
```

## Basic Setup

### 1. Server Configuration

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
      testMode: true,
      defaultSuccessUrl: "/success",
      onGrantAccess: async ({ customer, product, metadata }) => {
        // Grant user access
      },
      onRevokeAccess: async ({ customer, product, metadata }) => {
        // Revoke user access
      }
    })
  ]
});
```

### 2. Client Configuration

**Option A: Standard (Good)**
```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { creemClient } from "@creem_io/better-auth/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [creemClient()]
});
```

**Option B: Enhanced TypeScript (Better)**
```typescript
// lib/auth-client.ts
import { createCreemAuthClient } from "@creem_io/better-auth/create-creem-auth-client";
import { creemClient } from "@creem_io/better-auth/client";

export const authClient = createCreemAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [creemClient()]
});
```

### 3. Usage in Components

```typescript
"use client";

import { authClient } from "@/lib/auth-client";

export function SubscribeButton({ productId }: { productId: string }) {
  const handleSubscribe = async () => {
    const { data, error } = await authClient.creem.createCheckout({
      productId,
      successUrl: "/success"
    });
    
    if (data?.url) {
      window.location.href = data.url;
    }
  };
  
  return <button onClick={handleSubscribe}>Subscribe</button>;
}
```

## Environment Variables

```env
CREEM_API_KEY=your_api_key_here
CREEM_WEBHOOK_SECRET=your_webhook_secret_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Available Methods

- `createCheckout(input)` - Create a checkout session
- `createPortal(input?)` - Create customer portal session
- `cancelSubscription(input)` - Cancel a subscription
- `retrieveSubscription(input)` - Get subscription details
- `searchTransactions(input?)` - Search transaction history
- `hasAccessGranted()` - Check if user has access

## Type Imports

```typescript
import type {
  CreateCheckoutInput,
  CreatePortalInput,
  CancelSubscriptionInput,
  RetrieveSubscriptionInput,
  SearchTransactionsInput,
  HasAccessGrantedResponse,
  CreemOptions,
  GrantAccessContext,
  RevokeAccessContext
} from "@creem_io/better-auth";
```

## Next Steps

1. Set up webhooks in Creem dashboard: `https://yourdomain.com/api/auth/creem/webhook`
2. Implement access control handlers (`onGrantAccess`, `onRevokeAccess`)
3. Test in development with `testMode: true`
4. Switch to production mode when ready

For full documentation, see [README.md](./README.md)

