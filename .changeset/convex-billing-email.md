---
"@creem_io/convex": minor
---

Add billing email management. The Creem customer portal cannot change the email address invoices and receipts go to, so apps can now offer it themselves:

- `creem.customers.billingEmail(ctx, { entityId })` reads the address from Creem and `creem.customers.updateBillingEmail(ctx, { entityId, email })` changes it. Both return `{ status: "ok", email }`, or `{ status: "no-customer" }` before the entity's first checkout. An update also refreshes the `email` on the Convex customer record.
- `creem.api({ resolve })` generates `customers.billingEmail` and `customers.updateBillingEmail` actions; export them as `customersBillingEmail` and `customersUpdateBillingEmail` and `connectCreemApi` wires them. `customersUpdateBillingEmailArgs` is exported for custom RBAC wrappers.
- New `<BillingEmail>` widget for React and Svelte, hidden until the entity has a Creem customer and when the new `canManageBillingEmail` permission is `false`. Its labels live under `billingEmail` in the i18n labels.

The `creem` peer dependency now requires `^1.12.0`, the first SDK release whose customer update sends `email`.
