---
"@creem_io/convex": minor
---

This is a big feature release with breaking changes.

Features:

- i18n support for all billing UI text
- Usage limits / feature gates (`usageLimits`) with scoped trial expiry and `eligibilityScopeId` in the catalog
- Credits widgets for React and Svelte (`Credits*` components)
- Billing history widget (`BillingHistory`)
- Payment recovery primitives (`PaymentRecoveryBanner`, `PaymentRecoveryButton`)
- Provider factories: `createCreemReact` / `createCreemSvelte` with `CreemConvexProvider`
- Subscription widget slots (`SubscriptionGrid`, `SubscriptionGroup`, `SubscriptionGroupSelector`, `SubscriptionIntervalSelector`, `SubscriptionItem*` slot components, `SubscriptionUnitPicker`)
- `cancelPendingScheduledSubscriptionUpdates` mutation; scheduled-update cancellation integrated into the subscription update flow
- Product descriptions render markdown tables
- Hosted docs at docs.creem.io/code/sdks/convex, including an agent-oriented Integration Guide with a brownfield migration checklist
- Entity-scoped Customer Credits helpers for trusted app-owned grants and spending
- Packed-package compatibility audit for the intentional ESM/bundler support contract
- `PlanCatalogEntry.trialDays` declares the length of a Creem-managed trial, so the pricing card can offer it before checkout instead of a plain "Subscribe". Creem's product API does not expose trial configuration, so this mirrors the dashboard until config-as-code can drive both. New `BillingLabels.subscription` keys: `startFreeTrial` and `trialDaysFree`.
- `connectCreemApi(api.billing)` builds the connected widget API from the generated exports
- `pendingCheckout.peek()` reads a stored checkout intent without consuming it, so a resume can survive React StrictMode's double-invoked effects
- Every generated function declares a real Convex `returns` validator, so clients infer concrete result types instead of `any`
- Shared `BillingContextValue` contract in `core/` — the integration-agnostic seam the widgets will consume
- Subscription plan/group/cycle derivation extracted to `core/subscriptionModel.ts` and shared by the React and Svelte roots
- `Subscription.Grid` honours the root's `columns` prop, so composed and default layouts agree
- React and Svelte subscription widgets now share one plan-target resolver, update-command builder, and optimistic state projector, with lifecycle compensation that restores subscription, scheduled-update, and app-plan state together after failed Creem calls

Fixes (behaviour that was wrong in 0.3.x):

- Subscriptions that reach a terminal status (`canceled`, `expired`) are now closed out with `endedAt`, so they stop counting as the entity's current subscription. In 0.3.x only `canceled` did, so an `expired` subscription kept granting access indefinitely. `unpaid` and `paused` deliberately stay open so payment-recovery UI can still act on them
- Trial expiry is now driven by a scheduled mutation. A Convex query only re-runs when data changes, so the previous wall-clock comparison never re-fired on its own and a subscribed client kept seeing an active trial after it lapsed
- Timestamps from Creem are normalized to UTC on write. Every comparison in the component is a lexicographic string compare, so an offset-form timestamp stored verbatim (`2026-08-01T00:00:00+02:00`) sorted incorrectly against UTC values and could misclassify trial expiry and webhook staleness
- `insertCustomer` re-points the entity's Creem customer ID when it changes (test/live switch, customer re-created in the dashboard). In 0.3.x the stale ID was kept, so every subscription and order lookup for that entity missed and a paying user saw nothing. The mapping only ever moves forward in time, so a delayed webhook for the previous customer cannot drag it back
- `subscriptions.getCurrent` returns `product: null` when the subscription references a product that has not been synced yet, instead of throwing and taking down every query composed on top of it. **Breaking** — see the migration guide
- Orders arriving without a customer ID now fail loudly and let Creem retry, instead of being stored under an empty customer ID where no query could ever reach them
- `BillingPortal` surfaces portal errors instead of leaving an unhandled promise rejection with no user feedback
- `CheckoutButton` disables itself while a checkout is in flight and reports `aria-busy`. Cards pass their own `children`, which hid the loading label, so the button looked idle and a second click could open a second checkout session
- The unit `NumberInput` has an accessible name, and its `min`/`max`/`step` are exposed to assistive technology

Breaking changes:

See the [0.3.x migration guide](http://docs.creem.io/code/sdks/convex/migration#upgrading-from-0-3-x) for the complete list of breaking changes and upgrade instructions.

