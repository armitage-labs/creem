---
title: CREEM Webhooks Reference
noindex: true
---

# CREEM Webhooks Reference

Comprehensive guide to implementing webhook handlers for CREEM events.

## Contents

- Overview and Setup
- Network and WAF Configuration
- Signature Verification
- Retry Policy
- Event Structure
- Event Types: payloads for the events listed below
- Complete Webhook Handler
- Next.js Adapter
- Best Practices

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

## Network and WAF Configuration

CREEM does not provide static source IP addresses for outbound webhooks in
either production or Test Mode. If a firewall or WAF protects the webhook
endpoint, do not rely on source-IP allowlists as the authentication mechanism.
Keep the endpoint reachable over HTTPS and verify every request with the
`creem-signature` header.

Bot protection and WAF products can challenge webhook deliveries because
webhooks are automated server-to-server requests. If this happens, add a
route-level exception or skip rule for the webhook endpoint. On Cloudflare
specifically, Bot Fight Mode cannot be skipped with custom rules; disable it or
use Super Bot Fight Mode or Bot Management with a skip rule.

## Signature Verification

**CRITICAL**: Always verify signatures to prevent fraud.

The signature is sent in the `creem-signature` header as a HMAC-SHA256 hex digest.

```typescript
import crypto from "crypto";

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const computed = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  // timingSafeEqual throws on a length mismatch, so check that first.
  if (signature.length !== computed.length) return false;

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(signature, "hex"));
}
```

## Retry Policy

If your endpoint doesn't respond with HTTP 200, CREEM retries with progressive backoff. There are **5 attempts in total** — the initial delivery plus 4 retries:

| Attempt | Sent after the previous one |
| ------- | --------------------------- |
| 1       | Initial delivery            |
| 2       | 30 seconds                  |
| 3       | 5 minutes                   |
| 4       | 30 minutes                  |
| 5       | 6 hours                     |

Events are **not retried after 24 hours**, even if attempts remain. Once retries are exhausted the event is marked failed, and you can resend it manually from the dashboard.

Two things to design around:

- Retries mean your handler **must be idempotent** — the same event `id` can arrive more than once.
- The final retry can land roughly 6.5 hours after the event. Don't assume delivery within minutes, and anchor purchase time on `object.order.created_at` rather than when you received the event.

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
    "license_keys": [
      {
        "id": "lk_2wMk1RtYqPnZ7bVxCdEfGh",
        "object": "license",
        "product_id": "prod_d1AY2Sadk9YAvLI0pj97f",
        "key": "ABCDE-FGHIJ-KLMNO-PQRST-UVWXY",
        "status": "inactive",
        "activation": 0,
        "activation_limit": 1,
        "expires_at": null,
        "instance": null,
        "created_at": "2024-10-12T11:58:33.097Z",
        "mode": "test"
      }
    ],
    "custom_fields": [],
    "metadata": {
      "custom_data": "my custom data",
      "internal_customer_id": "internal_123"
    }
  }
}
```

**License keys.** When the purchased product issues license keys, the checkout
object carries a `license_keys` array. This is the delivery mechanism for keys —
you do not need to call the Licenses API to find out what was issued.

The field is **omitted entirely** when the order issued no keys, so test for its
presence rather than for an empty array. Each entry is a license *object*, not a
key string:

- `id` — license id, prefixed `lk_`
- `object` — always `license`
- `product_id` — the product the key was issued for
- `key` — the key itself: five groups of five uppercase alphanumerics, e.g. `ABCDE-FGHIJ-KLMNO-PQRST-UVWXY`
- `status` — `inactive` | `active` | `expired` | `disabled`; a key stays `inactive` until its first activation
- `activation` / `activation_limit` — activations used and allowed (`activation_limit: null` means unlimited)
- `expires_at` — ISO 8601, or `null` when the key does not expire
- `instance` — the associated license instance, or `null`
- `mode` — the environment the license belongs to

One key is issued per license-key feature on the product, multiplied by the
number of units purchased — a 3-unit order of a keyed product delivers three
entries. Always treat `license_keys` as a list, never as a single key.

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
      creemCustomerId: customer.id,
    });
  }

  // 2. Grant access based on product
  await db.subscriptions.create({
    userId: user.id,
    creemSubscriptionId: subscription?.id,
    productId: product.id,
    status: "active",
    metadata: metadata,
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
      status: "active",
      currentPeriodEnd: new Date(subscription.current_period_end_date),
      nextPaymentDate: new Date(subscription.next_transaction_date),
    },
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
      status: "canceled",
      canceledAt: new Date(subscription.canceled_at),
      // Keep access until period ends
      accessUntil: new Date(subscription.current_period_end_date),
    },
  });

  // Send cancellation confirmation
  await sendCancellationEmail(subscription.customer.email);
}
```

---

### subscription.scheduled_cancel

Fired when a subscription is scheduled to cancel at the end of the current billing period. The subscription remains active until `current_period_end_date`.

```json
{
  "id": "evt_4RfTc700qGW6FBzloh3Ms8",
  "eventType": "subscription.scheduled_cancel",
  "created_at": 1728734337932,
  "object": {
    "id": "sub_6pC2lNB6joCRQIZ1aMrTpi",
    "object": "subscription",
    "status": "scheduled_cancel",
    "product": {
      "id": "prod_d1AY2Sadk9YAvLI0pj97f",
      "name": "Monthly",
      "price": 1000,
      "billing_type": "recurring",
      "billing_period": "every-month"
    },
    "customer": {
      "id": "cust_1OcIK1GEuVvXZwD19tjq2z",
      "email": "customer@example.com"
    },
    "current_period_start_date": "2024-10-12T11:58:38.000Z",
    "current_period_end_date": "2024-11-12T11:58:38.000Z",
    "canceled_at": null,
    "metadata": {}
  }
}
```

**Handler Example:**

```typescript
async function handleSubscriptionScheduledCancel(subscription: SubscriptionObject) {
  await db.subscriptions.update({
    where: { creemSubscriptionId: subscription.id },
    data: {
      status: "scheduled_cancel",
      accessUntil: new Date(subscription.current_period_end_date),
    },
  });
}
```

---

### subscription.past_due

Fired when a subscription payment fails and the subscription enters a past-due state. Creem will retry payment; if a retry succeeds, the subscription can return to active.

```json
{
  "id": "evt_7HkTd800rHX7GCampi4Nt9",
  "eventType": "subscription.past_due",
  "created_at": 1728734337932,
  "object": {
    "id": "sub_6pC2lNB6joCRQIZ1aMrTpi",
    "object": "subscription",
    "status": "past_due",
    "product": {
      "id": "prod_d1AY2Sadk9YAvLI0pj97f",
      "name": "Monthly",
      "price": 1000,
      "billing_type": "recurring",
      "billing_period": "every-month"
    },
    "customer": {
      "id": "cust_1OcIK1GEuVvXZwD19tjq2z",
      "email": "customer@example.com"
    },
    "current_period_start_date": "2024-10-12T11:58:38.000Z",
    "current_period_end_date": "2024-11-12T11:58:38.000Z",
    "canceled_at": null,
    "metadata": {}
  }
}
```

**Handler Example:**

```typescript
async function handleSubscriptionPastDue(subscription: SubscriptionObject) {
  await db.subscriptions.update({
    where: { creemSubscriptionId: subscription.id },
    data: {
      status: "past_due",
      pastDueAt: new Date(),
    },
  });
}
```

---

### subscription.unpaid

Fired when a subscription moves to the `unpaid` status after failed payment collection. Treat it like `subscription.past_due` in payment-recovery UI, and suspend access according to your policy.

```json
{
  "id": "evt_h9hBneNdvWvA8hQzIBzDx",
  "eventType": "subscription.unpaid",
  "created_at": 1772265400331,
  "object": {
    "id": "sub_3xx35QzxsnpFiJ3vRB9YKt",
    "object": "subscription",
    "status": "unpaid",
    "product": {
      "id": "prod_L8mMzoYLOOZpMpTBwGw0k",
      "name": "Pro Plan",
      "price": 2999,
      "currency": "USD",
      "billing_type": "recurring",
      "billing_period": "every-month"
    },
    "customer": {
      "id": "cust_ubD9UtnJpafXNKQ5UaV0H",
      "email": "customer@example.com"
    },
    "collection_method": "charge_automatically",
    "last_transaction_id": "tran_6uBkPewvO7KHjfvGmpin82",
    "current_period_start_date": "2026-02-28T07:56:07.282Z",
    "current_period_end_date": "2026-03-30T07:56:07.282Z",
    "canceled_at": null,
    "metadata": {}
  }
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
  if (refund.subscription?.status === "canceled") {
    await db.subscriptions.update({
      where: { creemSubscriptionId: refund.subscription.id },
      data: {
        status: "refunded",
        accessUntil: new Date(), // Immediate revocation
      },
    });
  }

  // Log refund for accounting
  await db.refunds.create({
    transactionId: refund.transaction.id,
    amount: refund.refund_amount,
    currency: refund.refund_currency,
    reason: refund.reason,
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

### credits.granted

Fired when credits are added to a customer's credit account, for example a credit through the API or an auto-recharge top-up. Reversals don't fire it. `amount_minor_units` and `balance_after_minor_units` are strings in the account's units.

```json
{
  "id": "evt_4kR9vN2xQ7bT1mY8pW3cLd",
  "eventType": "credits.granted",
  "created_at": 1789430400123,
  "object": {
    "id": "cct_3mNpK8rW2xY",
    "object": "customer_credits_grant",
    "customer_id": "cust_abc123",
    "account_id": "cca_7hQ2nL5vX9k",
    "bucket_name": "ai_credits",
    "unit_label": "credits",
    "amount_minor_units": "5000",
    "balance_after_minor_units": "5250",
    "reference": "order_789",
    "occurred_at": "2026-09-15T00:00:00.000Z"
  }
}
```

---

### credits.consumed

Fired when credits are debited from a customer's credit account, either through the API or by prepaid usage settlement. Reversals don't fire it. Use `balance_after_minor_units` to warn a customer before their balance runs out.

```json
{
  "id": "evt_6pZ3cM8wK1rV5nB2tX9fQs",
  "eventType": "credits.consumed",
  "created_at": 1789430400456,
  "object": {
    "id": "cct_9tBvR4mX1pQ",
    "object": "customer_credits_consumption",
    "customer_id": "cust_abc123",
    "account_id": "cca_7hQ2nL5vX9k",
    "bucket_name": "ai_credits",
    "unit_label": "credits",
    "amount_minor_units": "10",
    "balance_after_minor_units": "5240",
    "reference": "req_01J9X8K2",
    "occurred_at": "2026-09-15T00:00:00.000Z"
  }
}
```

---

### customer_credits.exhausted

Fired when a customer's credits run out while Creem settles a prepaid usage price on one of their products. It fires once per exhaustion, and again only after credits were added and ran out again. Creem also emails the customer. A debit through the API that exceeds the balance doesn't fire it; that request fails with `422` and the error code `insufficient_balance`.

```json
{
  "id": "evt_1wT8kP4nR6vY2cM9bX5hLz",
  "eventType": "customer_credits.exhausted",
  "created_at": 1789430400789,
  "object": {
    "id": "credits-exhausted:store_test:cust_test:default:none",
    "object": "customer_credits_exhaustion",
    "customer_id": "cust_test",
    "bucket_name": "default",
    "unit_label": "credits",
    "shortfall_minor_units": "250",
    "occurred_at": "2026-09-15T00:00:00.000Z"
  }
}
```

---

### credits.auto_recharged

Fired when an empty credit account is topped up with an automatic charge. Only customers who opted in to auto-recharge trigger it, after the charge succeeds and the credits are added. The same top-up also fires `credits.granted`.

```json
{
  "id": "evt_8nQ5xL2vB7mR3kT9cW1pYd",
  "eventType": "credits.auto_recharged",
  "created_at": 1789430401012,
  "object": {
    "id": "cct_5kLm2Qx8vRt",
    "object": "customer_credits_auto_recharge",
    "customer_id": "cust_test",
    "bucket_name": "default",
    "unit_label": "credits",
    "amount_minor_units": "2000",
    "currency": "EUR",
    "charge_reference": "pay_test_charge",
    "reference": "usage-window:mtr_test:cust_test:2026-01-01:default"
  }
}
```

---

## Complete Webhook Handler

Here's a complete TypeScript webhook handler with all event types:

```typescript
import crypto from "crypto";

interface WebhookEvent {
  id: string;
  eventType: string;
  created_at: number;
  object: any;
}

export async function handleCreemWebhook(req: Request): Promise<Response> {
  // 1. Get signature and raw body
  const signature = req.headers.get("creem-signature");
  const rawBody = await req.text();

  if (!signature) {
    return new Response("Missing signature", { status: 401 });
  }

  // 2. Verify signature (length check first: timingSafeEqual throws on mismatch)
  const secret = process.env.CREEM_WEBHOOK_SECRET!;
  const computed = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  if (
    signature.length !== computed.length ||
    !crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(signature, "hex"))
  ) {
    return new Response("Invalid signature", { status: 401 });
  }

  // 3. Parse event
  const event: WebhookEvent = JSON.parse(rawBody);

  try {
    // 4. Handle event
    switch (event.eventType) {
      case "checkout.completed":
        await handleCheckoutCompleted(event.object);
        break;

      case "subscription.active":
        await handleSubscriptionActive(event.object);
        break;

      case "subscription.paid":
        await handleSubscriptionPaid(event.object);
        break;

      case "subscription.canceled":
        await handleSubscriptionCanceled(event.object);
        break;

      case "subscription.scheduled_cancel":
        await handleSubscriptionScheduledCancel(event.object);
        break;

      case "subscription.past_due":
        await handleSubscriptionPastDue(event.object);
        break;

      case "subscription.unpaid":
        await handleSubscriptionUnpaid(event.object);
        break;

      case "subscription.expired":
        await handleSubscriptionExpired(event.object);
        break;

      case "refund.created":
        await handleRefundCreated(event.object);
        break;

      case "dispute.created":
        await handleDisputeCreated(event.object);
        break;

      case "subscription.update":
        await handleSubscriptionUpdate(event.object);
        break;

      case "subscription.trialing":
        await handleSubscriptionTrialing(event.object);
        break;

      case "subscription.paused":
        await handleSubscriptionPaused(event.object);
        break;

      case "credits.granted":
        await handleCreditsGranted(event.object);
        break;

      case "credits.consumed":
        await handleCreditsConsumed(event.object);
        break;

      case "customer_credits.exhausted":
        await handleCustomerCreditsExhausted(event.object);
        break;

      case "credits.auto_recharged":
        await handleCreditsAutoRecharged(event.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.eventType}`);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook handler error:", error);
    // Return 500 to trigger retry
    return new Response("Internal error", { status: 500 });
  }
}
```

## Next.js Adapter

If using the `@creem_io/nextjs` package:

```typescript
// app/api/webhook/creem/route.ts
import { Webhook } from "@creem_io/nextjs";

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
