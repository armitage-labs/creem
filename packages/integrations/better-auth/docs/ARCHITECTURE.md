# Architecture Documentation

## Overview

The `@creem_io/better-auth` plugin integrates Creem payment and subscription management with Better-Auth, providing a seamless experience for developers.

## Design Principles

### 1. Flexibility First

- Support both Better Auth endpoints AND direct server-side functions
- Allow database persistence OR direct API calls
- Multiple import patterns for different use cases

### 2. TypeScript Excellence

- Full type safety across all APIs
- Clean IntelliSense with no generic noise
- JSDoc comments for inline documentation
- Automatic type inference where possible

### 3. Developer Experience

- Sensible defaults
- Clear error messages
- Comprehensive examples
- Multiple usage patterns

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                     User Application                     │
├──────────────────────┬──────────────────────────────────┤
│   Client-Side        │        Server-Side               │
│                      │                                   │
│  Better Auth         │  Better Auth      Server Utils   │
│  Endpoints           │  API              (Direct)       │
│  (createCheckout)    │  (auth.api...)    (createCheckout)
│                      │                                   │
└──────────────┬───────┴──────────────┬───────────────────┘
               │                      │
               v                      v
      ┌────────────────────────────────────────┐
      │     Creem Better-Auth Plugin           │
      │                                        │
      │  ┌──────────┐  ┌──────────────────┐  │
      │  │ Endpoints│  │ Server Utilities │  │
      │  └──────────┘  └──────────────────┘  │
      │                                        │
      │  ┌──────────────────────────────────┐ │
      │  │        Webhook Handlers          │ │
      │  └──────────────────────────────────┘ │
      │                                        │
      │  ┌──────────────────────────────────┐ │
      │  │        Database Schema           │ │
      │  │  (Optional - persistSubscriptions)│ │
      │  └──────────────────────────────────┘ │
      └──────────────┬────────────────────────┘
                     │
                     v
              ┌─────────────┐
              │  Creem SDK  │
              └──────┬──────┘
                     │
                     v
              ┌─────────────┐
              │  Creem API  │
              └─────────────┘
```

## Core Components

### 1. Plugin (`src/index.ts`)

The main plugin export that integrates with Better-Auth:

```typescript
export const creem = (options: CreemOptions) => {
  return {
    id: "creem",
    endpoints: {
      /* Better Auth endpoints */
    },
    schema: getSchema(options),
  } satisfies BetterAuthPlugin;
};
```

**Responsibilities:**

- Initialize Creem SDK
- Register Better Auth endpoints
- Define database schema
- Configure webhook handlers

### 2. Client Plugin (`src/client.ts`)

Client plugin for Better Auth's standard framework clients. `creemClient()` infers endpoint inputs,
successful responses, and the default persisted Creem user fields. When the server disables
persistence, use `creemClient({ persistSubscriptions: false })` so session types omit those fields.
This client option affects inference only; it does not configure the server.

**Responsibilities:**

- Infer client methods from the server plugin
- Map HTTP methods for Creem endpoints
- Infer session fields according to the configured persistence mode

### 3. Deprecated Wrapper (`src/create-creem-auth-client.ts`)

`createCreemAuthClient` remains exported for compatibility. New integrations use the standard
Better Auth `createAuthClient` with `creemClient()`. Native response inference now describes
successful responses because endpoint failures throw `APIError` instead of returning a competing
JSON shape. The wrapper can be migrated without losing the Creem endpoint methods.

### 4. Server Utilities (`src/creem-server.ts`)

Direct server-side functions that bypass Better Auth endpoints:

```typescript
export async function createCheckout(config, input) {
  const creem = createCreemClient(config);
  // Direct API call
}

export async function checkSubscriptionAccess(config, options) {
  // Database OR API mode
}
```

**Use Cases:**

- Server Components
- Server Actions
- API Routes
- Middleware
- Cron jobs

### 5. Endpoints

Better Auth endpoint implementations:

- `src/checkout.ts` - Create checkout sessions
- `src/portal.ts` - Customer portal access
- `src/cancel-subscription.ts` - Cancel subscriptions
- `src/retrieve-subscription.ts` - Get subscription details
- `src/search-transactions.ts` - Search transactions
- `src/has-active-subscription.ts` - Check access

**Pattern:**

```typescript
export const createCheckoutEndpoint = (creem, options) => {
  return createAuthEndpoint(
    "/creem/create-checkout",
    { method: "POST", body: CheckoutParams },
    createCheckoutHandler(creem, options),
  );
};
```

### 6. Webhooks (`src/webhook.ts`, `src/hooks.ts`)

Webhook processing with signature verification:

```typescript
// webhook.ts - Main webhook endpoint & event dispatch
// Verifies signature, parses event, dispatches to hooks.ts for DB ops,
// then calls user-provided callbacks (onGrantAccess, onCheckoutCompleted, etc.)
export const createWebhookEndpoint = (options) => {
  return createAuthEndpoint("/creem/webhook", ...);
};

// hooks.ts - Database operations only
// Each handler updates the local subscription/user records.
// Does NOT call user callbacks — that happens in webhook.ts.
export async function onSubscriptionActive(ctx, event, options) {
  // Update database
}
```

### 7. Database Schema (`src/schema.ts`)

Optional database tables for subscription persistence:

```typescript
export const subscriptions = {
  subscription: {
    fields: {
      productId: { type: "string", required: true },
      referenceId: { type: "string", required: true },
      status: { type: "string", defaultValue: "pending" },
      // ...
    },
  },
};
```

**Controlled by:** `persistSubscriptions` option (default: `true`). Setting it to `false` registers
neither subscription models nor Creem user fields and disables their writes. `schema` supports
physical model and column name mappings for existing fields, not new field definitions. The schema
is cloned before applying overrides so plugin instances cannot modify each other's configuration.

## Data Flow

### Checkout Flow

```
1. User clicks "Subscribe"
   ↓
2. Client calls authClient.creem.createCheckout()
   ↓
3. POST /api/auth/creem/create-checkout
   ↓
4. Get session from Better-Auth
   ↓
5. Call Creem SDK createCheckout()
   ↓
6. Return checkout URL
   ↓
7. Application navigates to URL (or opts into redirect: true)
   ↓
8. User completes payment
   ↓
9. Creem sends webhook
   ↓
10. Verify signature
    ↓
11. Update database (if persistSubscriptions: true)
    ↓
12. Call onGrantAccess callback
    ↓
13. Return success
```

### Access Check Flow (Database Mode)

```
1. Server Component needs to check access
   ↓
2. Call checkSubscriptionAccess()
   ↓
3. Query local database
   ↓
4. Check subscription status
   ↓
5. Return { hasAccess: true/false }
```

### Access Check Flow (API Mode)

```
1. Server Component needs to check access
   ↓
2. Call checkSubscriptionAccess()
   ↓
3. Call Creem API directly
   ↓
4. Check subscription status
   ↓
5. Return { hasAccess: true/false }
```

## Type System

### Type Organization

```
src/
├── *-types.ts        # Clean type exports for specific features
├── types.ts          # Plugin configuration types
└── webhook-types.ts  # Webhook event types
```

### Type Export Strategy

```typescript
// Main export (index.ts)
export type { CreemOptions } from "./types";
export type { CreateCheckoutInput } from "./checkout-types";

// Client export (client.ts)
export type { CreateCheckoutInput } from "./checkout-types";

// Server export (creem-server.ts)
export type { CreemServerConfig } from "./creem-server";
```

**Benefits:**

- Clean imports
- No circular dependencies
- Tree-shakeable
- IDE-friendly

## Modes of Operation

### Database Mode (Default)

```typescript
creem({
  apiKey: "...",
  persistSubscriptions: true, // default
});
```

**Features:**

- ✅ Fast access checks
- ✅ Offline data access
- ✅ SQL queries available
- ✅ Automatic sync via webhooks
- ✅ Full feature support

**Trade-offs:**

- Requires database schema
- Depends on webhook delivery
- Data slightly delayed

### API Mode

```typescript
creem({
  apiKey: "...",
  persistSubscriptions: false,
});
```

**Features:**

- ✅ No database needed
- ✅ Always fresh data
- ✅ Simpler setup

**Trade-offs:**

- API call required for checks
- Network dependency
- Some features limited

## Error Handling

The six billing and access endpoints throw Better Auth `APIError` for failures, preserving their
HTTP status codes. Catch blocks rethrow existing `APIError` values before wrapping unexpected
failures, so a validation or authentication error does not become a generic 500.

```typescript
import { APIError } from "better-auth/api";

if (!session?.user) {
  throw new APIError("UNAUTHORIZED", { message: "User must be logged in" });
}
```

- Browser clients receive `{ data: null, error }`, with `message`, `status`, and `statusText`.
- Direct `auth.api` calls throw the error.
- Calls with `asResponse: true` receive an HTTP error response whose JSON contains `message`.
- Successful access checks contain a boolean; unavailable or failed checks use the error path.

Successful return types therefore exclude failure payloads, allowing native Better Auth clients to
infer usable response types. HTTP serialization still applies: callers should narrow ID/expanded
object unions and parse date values before using date methods.

## Security

### Webhook Verification

```typescript
const signature = req.headers.get("creem-signature");
if (generateSignature(payload, secret) !== signature) {
  return ctx.json({ error: "Invalid signature" }, { status: 401 });
}
```

### Session Requirements

Portal, subscription, transaction, and access endpoints require authenticated sessions via Better Auth.
Checkout also supports requests without a session.

## Performance Considerations

### Database Queries

```typescript
// Fast: Single query to local database
const subscriptions = await db.select().from("subscription").where("referenceId", "=", userId);
```

### API Calls

```typescript
// Slower: External API call
const subscriptions = await creem.searchSubscriptions({
  xApiKey: apiKey,
  customerId,
});
```

**Recommendation:** Use database mode for frequently accessed data.

## Extension Points

### Custom Webhooks

```typescript
creem({
  onCheckoutCompleted: async (data) => {
    // Custom logic
  },
  onSubscriptionActive: async (data) => {
    // Custom logic
  },
});
```

### Custom Server Functions

Users can create their own utilities using the Creem SDK:

```typescript
import { createCreemClient } from "@creem_io/better-auth/server";

export async function customFunction() {
  const creem = createCreemClient(config);
  // Custom logic with Creem SDK
}
```

## Future Enhancements

- [x] Automated testing suite (183 unit tests via Vitest)
- [x] Next.js example app (`examples/nextjs/`)
- [ ] Subscription plan management
- [ ] Invoice generation helpers
- [ ] Usage-based billing support
- [ ] Multi-tenant support
- [ ] Subscription upgrades/downgrades
- [ ] Proration calculations
- [ ] Dunning management

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on contributing to this architecture.
