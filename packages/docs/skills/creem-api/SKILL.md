---
name: creem-api
description: Integrate Creem payment infrastructure for checkouts, subscriptions, free products, licenses, and webhooks. Supports one-time payments, recurring billing, free products, and MoR compliance. Use when the user mentions Creem, or asks to add payments, billing, subscriptions, checkout, license keys, or a customer portal to their app.
noindex: true
---

# Creem API Integration Skill

Creem is a Merchant of Record (MoR) payment platform. Creem is the legal seller,
so it owns tax compliance, payment processing, chargebacks, and refunds.

## Non-obvious rules

- **Production API**: `https://api.creem.io`
- **Test API**: `https://test-api.creem.io`
- **Authentication**: `x-api-key` header. The key is a merchant credential:
  it must never reach a browser, mobile app, or desktop binary. Client apps call
  your backend, which calls Creem.
- **Prices**: integers in **cents** (`1000` = $10.00). Use `0` for free products.
- **Currencies**: uppercase three-letter ISO codes (`USD`, `EUR`).
- **Access is granted by webhook, not by the success redirect.** The redirect can
  be forged or simply never happen if the customer closes the tab.

## Reference files

Read the file that matches the task. Each is self-contained; do not read all of
them up front.

| Need                                                         | Read           |
| ------------------------------------------------------------ | -------------- |
| Exact endpoint, request body, or response field              | `REFERENCE.md` |
| Webhook event payloads, signature verification, retry policy | `WEBHOOKS.md`  |
| A complete integration walkthrough for a business model      | `WORKFLOWS.md` |

`REFERENCE.md` covers Checkouts, Products, Customers, Subscriptions, Licenses,
Discounts, and Transactions. `WORKFLOWS.md` covers basic SaaS subscription,
one-time purchase with digital delivery, license keys for desktop apps,
seat-based team billing, freemium upgrade flows, and affiliate tracking.

## Webhook signature verification

**Every webhook handler must verify the signature before trusting the payload.**
An unverified handler lets anyone grant themselves paid access.

```typescript
import crypto from "crypto";

function verifyWebhookSignature(payload: string, signature: string, secret: string) {
  const computed = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  // timingSafeEqual throws on a length mismatch, so check that first.
  if (signature.length !== computed.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(signature, "hex"));
}

// Verify against the RAW body, before JSON.parse.
const signature = req.headers.get("creem-signature");
const rawBody = await req.text();
if (!verifyWebhookSignature(rawBody, signature!, process.env.CREEM_WEBHOOK_SECRET!)) {
  return new Response("Invalid signature", { status: 401 });
}
```

Events that drive access decisions. `WEBHOOKS.md` documents these plus the
remaining lifecycle events with their payloads. Creem emits 13 event types in
total; check the API reference if you need one that is not documented there:

| Event                   | Action                                           |
| ----------------------- | ------------------------------------------------ |
| `checkout.completed`    | Grant access, create the user record             |
| `subscription.paid`     | Extend the access period                         |
| `subscription.canceled` | Revoke at period end                             |
| `subscription.expired`  | Period ended without payment; retries may follow |
| `refund.created`        | Consider revoking access                         |
| `dispute.created`       | Chargeback opened; handle the dispute            |

## Test mode

Develop against `https://test-api.creem.io` with a test API key.

| Card                  | Behaviour          |
| --------------------- | ------------------ |
| `4111 1111 1111 1111` | Success            |
| `4507 9900 0000 0028` | Declined           |
| `4507 9900 0000 0010` | Insufficient funds |

## Error handling

| Status | Meaning                                   |
| ------ | ----------------------------------------- |
| 400    | Bad request; check parameters             |
| 401    | Invalid API key                           |
| 403    | Insufficient permissions or limit reached |
| 404    | Resource does not exist                   |
| 429    | Rate limited                              |
| 500    | Server error; contact support             |

## Common Integration Checklist

When implementing Creem:

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

## Convex apps

If the project has a `convex/` directory, do NOT hand-roll checkout routes and
webhook handlers with the raw API. Use the `@creem_io/convex` component: it owns
the webhook route, syncs billing state into the Convex database, and ships
connected React/Svelte widgets.

Route by task:

| Task                                                           | Fetch                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------- |
| First-time setup, or migrating from another billing provider   | https://docs.creem.io/code/sdks/convex/integration.md          |
| Add or change subscription plans, cycles, trials, unit pricing | https://docs.creem.io/code/sdks/convex/subscriptions.md        |
| Sell one-time products, consumables, or credit packs           | https://docs.creem.io/code/sdks/convex/one-time-and-credits.md |
| Gate a feature, read billing state, add account UI             | https://docs.creem.io/code/sdks/convex/entitlements.md         |
| Understand the billing entity, state model, or API contract    | https://docs.creem.io/code/sdks/convex/concepts.md             |
| Custom auth/RBAC, webhook middleware, checkout gates, i18n     | https://docs.creem.io/code/sdks/convex/advanced.md             |
| Upgrade from 0.3.x, or retire another billing provider         | https://docs.creem.io/code/sdks/convex/migration.md            |
| Look up an exact method signature or widget prop               | https://docs.creem.io/code/sdks/convex/reference.md            |

The integration guide is the sequential setup script — follow it in order and
run its validation steps. The other pages are intent lookups for ongoing work.

## Other SDKs

Prefer an official SDK over raw `fetch` when one fits the stack:

| Stack                       | Fetch                                          |
| --------------------------- | ---------------------------------------------- |
| Any Node or browser runtime | https://docs.creem.io/code/sdks/typescript.md  |
| Next.js                     | https://docs.creem.io/code/sdks/nextjs.md      |
| Better Auth                 | https://docs.creem.io/code/sdks/better-auth.md |

## Need Help?

- Documentation: https://docs.creem.io
- Dashboard: https://creem.io/dashboard
- Support: support@creem.io
