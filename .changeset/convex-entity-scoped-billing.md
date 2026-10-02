---
"@creem_io/convex": minor
---

Scope subscriptions and orders to the billing entity, not just the Creem customer. Creem keeps one customer per store and email address, so a person who checks out for two billing entities (a personal account and an organization, say) maps both to the same customer, and each entity used to see, and could act on, the other's subscriptions and orders.

- `listAllUserSubscriptions`, `listUserSubscriptions`, `getCurrentSubscription`, `listUserOrders`, the billing snapshot, `getBillingModel` and `uiModel` return only rows whose `convexBillingEntityId` metadata names the entity. Rows without that metadata (created before checkouts recorded it) count for an entity only while nothing on the customer points at another entity; the new `backfillBillingEntityTags` component mutation tags them where the owner is unambiguous.
- Webhooks no longer drop or change the entity a subscription or order already names, and an embedded checkout subscription without metadata inherits the checkout's entity.
- Subscription commands (`update`, `cancel`, `resume`, `pause`, `cancelScheduledUpdate`) reject a subscription ID that belongs to another entity on the same customer, like an unknown ID, and period-end updates are checked again when they apply.
- New component queries `listCustomerEntities` and `isCustomerShared` and client method `creem.customers.isShared(ctx, { entityId })`. A customer counts as shared when another entity maps to it or owns one of its subscriptions or orders.
- While the customer is shared, `customers.portalUrl` throws a `ConvexError` with `code: "shared-customer"` (`<BillingPortal>` and `<PaymentRecoveryButton>` show the new `portal.sharedCustomer` label), and `customers.updateBillingEmail` returns `{ status: "shared-customer" }` without changing anything (`<BillingEmail>` shows `billingEmail.sharedCustomer`).
- Transactions (`transactions.search`, `<BillingHistory>`) and Customer Credits stay scoped to the Creem customer.
