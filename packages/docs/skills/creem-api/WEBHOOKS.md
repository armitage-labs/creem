# CREEM Webhooks Reference

Comprehensive guide to implementing webhook handlers for CREEM events.

## Overview

Webhooks push real-time notifications about payments, subscriptions, and other events to your application. They are essential for:

- Granting access after payment
- Revoking access on cancellation
- Syncing subscription status
- Handling refunds and disputes

## Setup

1. Create a webhook endpoint in your application
2. Register the URL in the CREEM Dashboard (Developers > Webhooks)
3. Copy the webhook secret for signature verification
4. Test with the test environment before going live

## Signature Verification

**CRITICAL**: Always verify signatures to prevent fraud.

The signature is sent in the `creem-signature` header as a HMAC-SHA256 hex digest.

```typescript
import crypto from 'crypto';

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(computed, 'hex'),
    Buffer.from(signature, 'hex')
  );
}
```

## Retry Policy

If your endpoint doesn't respond with HTTP 200, CREEM retries with exponential backoff:

1. Initial attempt
2. 30 seconds later
3. 1 minute later
4. 5 minutes later
5. 1 hour later

After all retries fail, the event is marked as failed. You can manually resend from the dashboard.

## Event Structure

All webhook events follow this structure:

```json
{
  "id": "evt_unique_event_id",
  "eventType": "event.type",
  "created_at": 1728734325927,
  "object": {
    // Event-specific payload
  }
}
```

---

## Event Types

### checkout.completed

Fired when a customer successfully completes a checkout. This is your primary trigger for granting access.

```json
{
  "id": "evt_5WHHcZPv7VS0YUsberIuOz",
  "eventType": "checkout.completed",
  "created_at": 1728734325927,
  "object": {
    "id": "ch_4l0N34kxo16AhRKUHFUuXr",
    "object": "checkout",
    "request_id": "my-request-id",
    "status": "completed",
    "mode": "test",
    "order": {
      "id": "ord_4aDwWXjMLpes4Kj4XqNnUA",
      "customer": "cust_1OcIK1GEuVvXZwD19tjq2z",
      "product": "prod_d1AY2Sadk9YAvLI0pj97f",
      "amount": 1000,
      "currency": "EUR",
      "status": "paid",
      "type": "recurring",
      "created_at": "2024-10-12T11:58:33.097Z",
      "updated_at": "2024-10-12T11:58:33.097Z"
    },
    "product": {
      "id": "prod_d1AY2Sadk9YAvLI0pj97f",
      "name": "Monthly",
      "description": "Monthly plan",
      "price": 1000,
      "currency": "EUR",
      "billing_type": "recurring",
      "billing_period": "every-month",
      "status": "active",
      "tax_mode": "exclusive",
      "tax_category": "saas"
    },
    "customer": {
      "id": "cust_1OcIK1GEuVvXZwD19tjq2z",
      "object": "customer",
      "email": "customer@example.com",
      "name": "John Doe",
      "country": "NL"
    },
    "subscription": {
      "id": "sub_6pC2lNB6joCRQIZ1aMrTpi",
      "object": "subscription",
      "product": "prod_d1AY2Sadk9YAvLI0pj97f",
      "customer": "cust_1OcIK1GEuVvXZwD19tjq2z",
      "status": "active",
      "collection_method": "charge_automatically",
      "metadata": {
        "custom_data": "my custom data",
        "internal_customer_id": "internal_123"
      }
    },
    "custom_fields": [],
    "metadata": {
      "custom_data": "my custom data",
      "internal_customer_id": "internal_123"
    }
  }
}
```

**Handler Example:**

```typescript
async function handleCheckoutCompleted(checkout: CheckoutObject) {
  const { customer, subscription, product, metadata, order } = checkout;

  // 1. Find or create user
  let user = await db.users.findByEmail(customer.email);
  if (!user) {
    user = await db.users.create({
      email: customer.email,
      name: customer.name,
      creemCustomerId: customer.id
    });
  }

  // 2. Grant access based on product
  await db.subscriptions.create({
    userId: user.id,
    creemSubscriptionId: subscription?.id,
    productId: product.id,
    status: 'active',
    metadata: metadata
  });

  // 3. Send welcome email
  await sendWelcomeEmail(user.email, product.name);
}
```

---

### subscription.active

Fired when a new subscription is created and first payment collected. Use `subscription.paid` for granting access instead - this is mainly for synchronization.

```json
{
  "id": "evt_6EptlmjazyGhEPiNQ5f4lz",
  "eventType": "subscription.active",
  "created_at": 1728734325927,
  "object": {
    "id": "sub_21lfZb67szyvMiXnm6SVi0",
    "object": "subscription",
    "status": "active",
    "collection_method": "charge_automatically",
    "product": {
      "id": "prod_AnVJ11ujp7x953ARpJvAF",
      "name": "Pro Plan",
      "price": 10000,
      "currency": "EUR",
      "billing_type": "recurring",
      "billing_period": "every-month"
    },
    "customer": {
      "id": "cust_3biFPNt4Cz5YRDSdIqs7kc",
      "email": "customer@example.com",
      "name": "John Doe",
      "country": "SE"
    },
    "created_at": "2024-09-16T19:40:41.984Z",
    "updated_at": "2024-09-16T19:40:42.121Z"
  }
}
```

---

### subscription.paid

Fired when a subscription payment is successfully processed. This includes initial payments and renewals.

```json
{
  "id": "evt_21mO1jWmU2QHe7u2oFV7y1",
  "eventType": "subscription.paid",
  "created_at": 1728734327355,
  "object": {
    "id": "sub_6pC2lNB6joCRQIZ1aMrTpi",
    "object": "subscription",
    "status": "active",
    "product": {
      "id": "prod_d1AY2Sadk9YAvLI0pj97f",
      "name": "Monthly",
      "price": 1000,
      "currency": "EUR",
      "billing_type": "recurring",
      "billing_period": "every-month"
    },
    "customer": {
      "id": "cust_1OcIK1GEuVvXZwD19tjq2z",
      "email": "customer@example.com",
      "name": "John Doe",
      "country": "NL"
    },
    "collection_method": "charge_automatically",
    "last_transaction_id": "tran_5yMaWzAl3jxuGJMCOrYWwk",
    "last_transaction_date": "2024-10-12T11:58:47.109Z",
    "next_transaction_date": "2024-11-12T11:58:38.000Z",
    "current_period_start_date": "2024-10-12T11:58:38.000Z",
    "current_period_end_date": "2024-11-12T11:58:38.000Z",
    "canceled_at": null,
    "metadata": {
      "custom_data": "my custom data"
    }
  }
}
```

**Handler Example:**

```typescript
async function handleSubscriptionPaid(subscription: SubscriptionObject) {
  // Extend access period
  await db.subscriptions.update({
    where: { creemSubscriptionId: subscription.id },
    data: {
      status: 'active',
      currentPeriodEnd: new Date(subscription.current_period_end_date),
      nextPaymentDate: new Date(subscription.next_transaction_date)
    }
  });
}
```

---

### subscription.canceled

Fired when a subscription is canceled (by customer or merchant).

```json
{
  "id": "evt_2iGTc600qGW6FBzloh2Nr7",
  "eventType": "subscription.canceled",
  "created_at": 1728734337932,
  "object": {
    "id": "sub_6pC2lNB6joCRQIZ1aMrTpi",
    "object": "subscription",
    "status": "canceled",
    "product": {
      "id": "prod_d1AY2Sadk9YAvLI0pj97f",
      "name": "Monthly"
    },
    "customer": {
      "id": "cust_1OcIK1GEuVvXZwD19tjq2z",
      "email": "customer@example.com"
    },
    "current_period_start_date": "2024-10-12T11:58:38.000Z",
    "current_period_end_date": "2024-11-12T11:58:38.000Z",
    "canceled_at": "2024-10-12T11:58:57.813Z",
    "metadata": {}
  }
}
```

**Handler Example:**

```typescript
async function handleSubscriptionCanceled(subscription: SubscriptionObject) {
  // Revoke access at period end (not immediately)
  await db.subscriptions.update({
    where: { creemSubscriptionId: subscription.id },
    data: {
      status: 'canceled',
      canceledAt: new Date(subscription.canceled_at),
      // Keep access until period ends
      accessUntil: new Date(subscription.current_period_end_date)
    }
  });

  // Send cancellation confirmation
  await sendCancellationEmail(subscription.customer.email);
}
```

---

### subscription.expired

Fired when the billing period ends without successful payment. Retries may still happen.

```json
{
  "id": "evt_V5CxhipUu10BYonO2Vshb",
  "eventType": "subscription.expired",
  "created_at": 1734463872058,
  "object": {
    "id": "sub_7FgHvrOMC28tG5DEemoCli",
    "object": "subscription",
    "status": "active",
    "product": {
      "id": "prod_3ELsC3Lt97orn81SOdgQI3",
      "name": "Annual Plan",
      "price": 1200,
      "billing_period": "every-year"
    },
    "customer": {
      "id": "cust_3y4k2CELGsw7n9Eeeiw2hm",
      "email": "customer@example.com"
    },
    "current_period_end_date": "2024-12-16T12:39:47.000Z"
  }
}
```

**Note:** Status remains "active" during retry period. Only act on `subscription.canceled` for terminal state.

---

### subscription.trialing

Fired when a subscription enters a trial period.

```json
{
  "id": "evt_2ciAM8ABYtj0pVueeJPxUZ",
  "eventType": "subscription.trialing",
  "created_at": 1739963911073,
  "object": {
    "id": "sub_dxiauR8zZOwULx5QM70wJ",
    "object": "subscription",
    "status": "trialing",
    "product": {
      "id": "prod_3kpf0ZdpcfsSCQ3kDiwg9m",
      "name": "Pro Plan with Trial",
      "price": 1100
    },
    "customer": {
      "id": "cust_4fpU8kYkQmI1XKBwU2qeME",
      "email": "customer@example.com"
    },
    "current_period_start_date": "2025-02-19T11:18:25.000Z",
    "current_period_end_date": "2025-02-26T11:18:25.000Z",
    "items": [
      {
        "id": "sitem_1xbHCmIM61DHGRBCFn0W1L",
        "product_id": "prod_3kpf0ZdpcfsSCQ3kDiwg9m",
        "units": 1
      }
    ]
  }
}
```

---

### subscription.paused

Fired when a subscription is paused.

```json
{
  "id": "evt_5veN2cn5N9Grz8u7w3yJuL",
  "eventType": "subscription.paused",
  "created_at": 1754041946898,
  "object": {
    "id": "sub_3ZT1iYMeDBpiUpRTqq4veE",
    "object": "subscription",
    "status": "paused",
    "product": {
      "id": "prod_sYwbyE1tPbsqbLu6S0bsR",
      "name": "Monthly Plan",
      "price": 2000
    },
    "customer": {
      "id": "cust_4fpU8kYkQmI1XKBwU2qeME",
      "email": "customer@example.com"
    },
    "current_period_end_date": "2025-09-01T09:51:47.000Z"
  }
}
```

---

### subscription.update

Fired when a subscription is modified (seats changed, upgraded, etc.).

```json
{
  "id": "evt_5pJMUuvqaqvttFVUvtpY32",
  "eventType": "subscription.update",
  "created_at": 1737890536421,
  "object": {
    "id": "sub_2qAuJgWmXhXHAuef9k4Kur",
    "object": "subscription",
    "status": "active",
    "product": {
      "id": "prod_1dP15yoyogQe2seEt1Evf3",
      "name": "Monthly Sub",
      "price": 1000
    },
    "customer": {
      "id": "cust_2fQZKKUZqtNhH2oDWevQkW",
      "email": "customer@example.com"
    },
    "items": [
      {
        "id": "sitem_3QWlqRbAat2eBRakAxFtt9",
        "product_id": "prod_5jnudVkLGZWF4AqMFBs5t5",
        "units": 1
      }
    ],
    "current_period_end_date": "2025-02-26T11:20:36.000Z"
  }
}
```

---

### refund.created

Fired when a refund is processed.

```json
{
  "id": "evt_61eTsJHUgInFw2BQKhTiPV",
  "eventType": "refund.created",
  "created_at": 1728734351631,
  "object": {
    "id": "ref_3DB9NQFvk18TJwSqd0N6bd",
    "object": "refund",
    "status": "succeeded",
    "refund_amount": 1210,
    "refund_currency": "EUR",
    "reason": "requested_by_customer",
    "transaction": {
      "id": "tran_5yMaWzAl3jxuGJMCOrYWwk",
      "amount": 1000,
      "amount_paid": 1210,
      "status": "refunded"
    },
    "subscription": {
      "id": "sub_6pC2lNB6joCRQIZ1aMrTpi",
      "status": "canceled"
    },
    "customer": {
      "id": "cust_1OcIK1GEuVvXZwD19tjq2z",
      "email": "customer@example.com"
    },
    "created_at": 1728734351525
  }
}
```

**Handler Example:**

```typescript
async function handleRefund(refund: RefundObject) {
  // Check if this requires access revocation
  if (refund.subscription?.status === 'canceled') {
    await db.subscriptions.update({
      where: { creemSubscriptionId: refund.subscription.id },
      data: {
        status: 'refunded',
        accessUntil: new Date() // Immediate revocation
      }
    });
  }

  // Log refund for accounting
  await db.refunds.create({
    transactionId: refund.transaction.id,
    amount: refund.refund_amount,
    currency: refund.refund_currency,
    reason: refund.reason
  });
}
```

---

### dispute.created

Fired when a chargeback/dispute is opened.

```json
{
  "id": "evt_6mfLDL7P0NYwYQqCrICvDH",
  "eventType": "dispute.created",
  "created_at": 1750941264812,
  "object": {
    "id": "disp_6vSsOdTANP5PhOzuDlUuXE",
    "object": "dispute",
    "amount": 1331,
    "currency": "EUR",
    "transaction": {
      "id": "tran_4Dk8CxWFdceRUQgMFhCCXX",
      "status": "chargeback"
    },
    "subscription": {
      "id": "sub_5sD6zM482uwOaEoyEUDDJs",
      "status": "active"
    },
    "customer": {
      "id": "cust_OJPZd2GMxgo1MGPNXXBSN",
      "email": "customer@example.com"
    },
    "created_at": 1750941264728
  }
}
```

---

## Complete Webhook Handler

Here's a complete TypeScript webhook handler with all event types:

```typescript
import crypto from 'crypto';

interface WebhookEvent {
  id: string;
  eventType: string;
  created_at: number;
  object: any;
}

export async function handleCreemWebhook(req: Request): Promise<Response> {
  // 1. Get signature and raw body
  const signature = req.headers.get('creem-signature');
  const rawBody = await req.text();

  if (!signature) {
    return new Response('Missing signature', { status: 401 });
  }

  // 2. Verify signature
  const secret = process.env.CREEM_WEBHOOK_SECRET!;
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'))) {
    return new Response('Invalid signature', { status: 401 });
  }

  // 3. Parse event
  const event: WebhookEvent = JSON.parse(rawBody);

  try {
    // 4. Handle event
    switch (event.eventType) {
      case 'checkout.completed':
        await handleCheckoutCompleted(event.object);
        break;

      case 'subscription.active':
        await handleSubscriptionActive(event.object);
        break;

      case 'subscription.paid':
        await handleSubscriptionPaid(event.object);
        break;

      case 'subscription.canceled':
        await handleSubscriptionCanceled(event.object);
        break;

      case 'subscription.expired':
        await handleSubscriptionExpired(event.object);
        break;

      case 'subscription.trialing':
        await handleSubscriptionTrialing(event.object);
        break;

      case 'subscription.paused':
        await handleSubscriptionPaused(event.object);
        break;

      case 'subscription.update':
        await handleSubscriptionUpdate(event.object);
        break;

      case 'refund.created':
        await handleRefundCreated(event.object);
        break;

      case 'dispute.created':
        await handleDisputeCreated(event.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.eventType}`);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook handler error:', error);
    // Return 500 to trigger retry
    return new Response('Internal error', { status: 500 });
  }
}
```

## Next.js Adapter

If using the `@creem_io/nextjs` package:

```typescript
// app/api/webhook/creem/route.ts
import { Webhook } from '@creem_io/nextjs';

export const POST = Webhook({
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,

  onCheckoutCompleted: async ({ customer, product, subscription, metadata }) => {
    console.log(`${customer.email} purchased ${product.name}`);
    // Grant access
  },

  onGrantAccess: async ({ customer, metadata }) => {
    const userId = metadata?.referenceId as string;
    await grantAccess(userId, customer.email);
  },

  onRevokeAccess: async ({ customer, metadata }) => {
    const userId = metadata?.referenceId as string;
    await revokeAccess(userId, customer.email);
  },
});
```

## Best Practices

1. **Always verify signatures** - Never process unverified webhooks
2. **Return 200 quickly** - Process asynchronously if needed
3. **Be idempotent** - Handle duplicate deliveries gracefully
4. **Log events** - Keep records for debugging
5. **Handle all relevant events** - Don't miss critical state changes
6. **Test in sandbox** - Verify handlers before production
7. **Monitor failures** - Set up alerts for webhook failures
