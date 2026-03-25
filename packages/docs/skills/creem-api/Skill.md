---
name: CREEM API Integration
description: Integrate CREEM payment infrastructure for checkouts, subscriptions, licenses, and webhooks. Supports one-time payments, recurring billing, and MoR compliance.
---

# CREEM API Integration Skill

You are an expert at integrating CREEM, a Merchant of Record (MoR) payment platform for SaaS and digital businesses. You help developers implement checkout flows, manage subscriptions, handle webhooks, and work with license keys.

## Core Concepts

CREEM acts as the legal seller (Merchant of Record), handling tax compliance, payment processing, and refunds. When integrating:

- **Production API**: `https://api.creem.io`
- **Test API**: `https://test-api.creem.io`
- **Authentication**: `x-api-key` header with API key from dashboard
- **Prices**: Always in **cents** (1000 = $10.00)
- **Currencies**: Three-letter ISO codes in uppercase (USD, EUR, etc.)

## Authentication Setup

Always configure authentication properly:

```typescript
// Environment variables (never commit API keys)
const API_KEY = process.env.CREEM_API_KEY;
const BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.creem.io'
  : 'https://test-api.creem.io';

// All requests require the x-api-key header
const headers = {
  'x-api-key': API_KEY,
  'Content-Type': 'application/json'
};
```

## Quick Reference: API Endpoints

### Checkouts
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/checkouts` | Create checkout session |
| GET | `/v1/checkouts?checkout_id={id}` | Retrieve checkout |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/products` | Create product |
| GET | `/v1/products?product_id={id}` | Retrieve product |
| GET | `/v1/products/search` | List all products |

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/customers?customer_id={id}` | Retrieve customer |
| GET | `/v1/customers?email={email}` | Retrieve by email |
| GET | `/v1/customers/list` | List all customers |
| POST | `/v1/customers/billing` | Generate portal link |

### Subscriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/subscriptions?subscription_id={id}` | Retrieve subscription |
| POST | `/v1/subscriptions/{id}` | Update subscription |
| POST | `/v1/subscriptions/{id}/upgrade` | Upgrade plan |
| POST | `/v1/subscriptions/{id}/cancel` | Cancel subscription |
| POST | `/v1/subscriptions/{id}/pause` | Pause subscription |
| POST | `/v1/subscriptions/{id}/resume` | Resume subscription |

### Licenses
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/licenses/activate` | Activate license |
| POST | `/v1/licenses/validate` | Validate license |
| POST | `/v1/licenses/deactivate` | Deactivate license |

### Discounts
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/discounts` | Create discount |
| GET | `/v1/discounts?discount_id={id}` | Retrieve discount |
| GET | `/v1/discounts?discount_code={code}` | Retrieve by code |
| DELETE | `/v1/discounts/{id}/delete` | Delete discount |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/transactions?transaction_id={id}` | Get transaction |
| GET | `/v1/transactions/search` | List transactions |

## Implementation Patterns

### 1. Create a Checkout Session

The most common integration pattern - redirect users to CREEM's hosted checkout:

```typescript
// POST /v1/checkouts
const createCheckout = async (productId: string, options?: {
  requestId?: string;
  successUrl?: string;
  customerEmail?: string;
  discountCode?: string;
  units?: number;
  metadata?: Record<string, any>;
}) => {
  const response = await fetch(`${BASE_URL}/v1/checkouts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      product_id: productId,
      request_id: options?.requestId,
      success_url: options?.successUrl,
      customer: options?.customerEmail ? { email: options.customerEmail } : undefined,
      discount_code: options?.discountCode,
      units: options?.units,
      metadata: options?.metadata
    })
  });

  const checkout = await response.json();
  // Redirect user to: checkout.checkout_url
  return checkout;
};
```

**Success URL query parameters** after payment:
- `checkout_id` - Checkout session ID
- `order_id` - Order created
- `customer_id` - Customer ID
- `subscription_id` - Subscription (if recurring)
- `product_id` - Product purchased
- `request_id` - Your tracking ID (if provided)
- `signature` - HMAC signature for verification

### 2. Webhook Handler

**CRITICAL**: Always verify webhook signatures to prevent fraud.

```typescript
import crypto from 'crypto';

// Signature verification
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const computed = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return computed === signature;
}

// Webhook handler
export async function handleWebhook(req: Request) {
  const signature = req.headers.get('creem-signature');
  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, signature!, process.env.CREEM_WEBHOOK_SECRET!)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(rawBody);

  switch (event.eventType) {
    case 'checkout.completed':
      // Payment successful - grant access
      await handleCheckoutCompleted(event.object);
      break;
    case 'subscription.paid':
      // Recurring payment - extend access
      await handleSubscriptionPaid(event.object);
      break;
    case 'subscription.canceled':
      // Subscription ended - revoke access at period end
      await handleSubscriptionCanceled(event.object);
      break;
    case 'subscription.expired':
      // Subscription expired - payment retries may happen
      await handleSubscriptionExpired(event.object);
      break;
    case 'refund.created':
      // Refund processed - may need to revoke access
      await handleRefund(event.object);
      break;
  }

  return new Response('OK', { status: 200 });
}
```

### 3. License Key Management

For desktop apps, CLI tools, or software requiring activation:

```typescript
// Activate on first use
const activateLicense = async (licenseKey: string, instanceName: string) => {
  const response = await fetch(`${BASE_URL}/v1/licenses/activate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      key: licenseKey,
      instance_name: instanceName // e.g., "johns-macbook-pro"
    })
  });

  const result = await response.json();
  // Store result.instance.id locally for future validation
  return result;
};

// Validate on app startup
const validateLicense = async (licenseKey: string, instanceId: string) => {
  const response = await fetch(`${BASE_URL}/v1/licenses/validate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      key: licenseKey,
      instance_id: instanceId
    })
  });

  const result = await response.json();
  // result.status: "active" | "inactive" | "expired" | "disabled"
  return result;
};

// Deactivate when user switches device
const deactivateLicense = async (licenseKey: string, instanceId: string) => {
  const response = await fetch(`${BASE_URL}/v1/licenses/deactivate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      key: licenseKey,
      instance_id: instanceId
    })
  });
  return response.json();
};
```

### 4. Subscription Management

```typescript
// Update seat count
const updateSubscriptionSeats = async (subscriptionId: string, itemId: string, newUnits: number) => {
  const response = await fetch(`${BASE_URL}/v1/subscriptions/${subscriptionId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      items: [{ id: itemId, units: newUnits }],
      update_behavior: 'proration-charge-immediately' // or 'proration-charge', 'proration-none'
    })
  });
  return response.json();
};

// Upgrade to different plan
const upgradeSubscription = async (subscriptionId: string, newProductId: string) => {
  const response = await fetch(`${BASE_URL}/v1/subscriptions/${subscriptionId}/upgrade`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      product_id: newProductId,
      update_behavior: 'proration-charge-immediately'
    })
  });
  return response.json();
};

// Cancel subscription
const cancelSubscription = async (subscriptionId: string, immediate: boolean = false) => {
  const response = await fetch(`${BASE_URL}/v1/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      mode: immediate ? 'immediate' : 'scheduled' // scheduled = at period end
    })
  });
  return response.json();
};
```

### 5. Customer Portal

Let customers manage their own subscriptions:

```typescript
const getCustomerPortalLink = async (customerId: string) => {
  const response = await fetch(`${BASE_URL}/v1/customers/billing`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ customer_id: customerId })
  });

  const { customer_portal_link } = await response.json();
  return customer_portal_link;
};
```

## Webhook Events Reference

| Event | When | Action |
|-------|------|--------|
| `checkout.completed` | Payment successful | Grant access, create user |
| `subscription.active` | New subscription created | Sync to database |
| `subscription.paid` | Recurring payment processed | Extend access period |
| `subscription.canceled` | User/merchant canceled | Revoke at period end |
| `subscription.expired` | Period ended without payment | Retries may happen |
| `subscription.trialing` | Trial started | Grant trial access |
| `subscription.paused` | Subscription paused | Pause features |
| `subscription.update` | Subscription modified | Sync changes |
| `refund.created` | Refund processed | May revoke access |
| `dispute.created` | Chargeback opened | Handle dispute |

## Error Handling

All endpoints return standard HTTP status codes:

```typescript
const handleApiResponse = async (response: Response) => {
  if (response.ok) {
    return response.json();
  }

  switch (response.status) {
    case 400: throw new Error('Bad Request - Check parameters');
    case 401: throw new Error('Unauthorized - Invalid API key');
    case 403: throw new Error('Forbidden - Insufficient permissions or limit reached');
    case 404: throw new Error('Not Found - Resource does not exist');
    case 429: throw new Error('Rate Limited - Too many requests');
    case 500: throw new Error('Server Error - Contact support');
    default: throw new Error(`Unexpected error: ${response.status}`);
  }
};
```

## Test Mode

Always develop in test mode first:

1. Use `https://test-api.creem.io` as base URL
2. Use test API key from dashboard
3. Test cards:
   - `4242 4242 4242 4242` - Success
   - `4000 0000 0000 0002` - Declined
   - `4000 0000 0000 9995` - Insufficient funds

## Common Integration Checklist

When implementing CREEM:

1. **Environment Setup**
   - [ ] Store API key in environment variables
   - [ ] Configure base URL for test/production
   - [ ] Set up webhook endpoint

2. **Checkout Flow**
   - [ ] Create checkout session with product_id
   - [ ] Include request_id for tracking
   - [ ] Set success_url with verification
   - [ ] Handle checkout.completed webhook

3. **Subscription Handling**
   - [ ] Handle subscription.paid for renewals
   - [ ] Handle subscription.canceled for access revocation
   - [ ] Implement customer portal link
   - [ ] Store subscription_id for management

4. **License Keys** (if applicable)
   - [ ] Implement activate on first use
   - [ ] Validate on each app start
   - [ ] Handle deactivation for device transfer

5. **Security**
   - [ ] Verify webhook signatures
   - [ ] Never expose API keys client-side
   - [ ] Validate success URL signatures

## File References

For detailed information, see:
- `REFERENCE.md` - Complete API reference with all fields
- `WEBHOOKS.md` - Webhook payload examples
- `WORKFLOWS.md` - Step-by-step integration patterns

## Need Help?

- Documentation: https://docs.creem.io
- Dashboard: https://creem.io/dashboard
- Support: support@creem.io
