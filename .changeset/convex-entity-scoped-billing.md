---
"@creem_io/convex": minor
---

Scope subscriptions and orders to the billing entity, not just the Creem customer. Creem keeps one customer per store and email address, so a person who checks out for two billing entities (a personal account and an organization, say) maps both to the same customer, and each entity used to see, and could act on, the other's subscriptions and orders.

- `listAllUserSubscriptions`, `listUserSubscriptions`, `getCurrentSubscription`, `listUserOrders`, the billing snapshot, `getBillingModel` and `uiModel` return only rows whose `convexBillingEntityId` metadata names the entity. Rows without that metadata (created before checkouts recorded it) count for the entity only while no other row of the same customer names a different entity.
- Subscription commands (`update`, `cancel`, `resume`, `pause`, `cancelScheduledUpdate`) reject a subscription ID that belongs to another entity on the same customer, like an unknown ID.
- New component query `listCustomerEntities` and client method `creem.customers.isShared(ctx, { entityId })`.
- `customers.updateBillingEmail` returns `{ status: "shared-customer" }` without changing anything while the customer is shared, and `<BillingEmail>` shows the new `billingEmail.sharedCustomer` label.
