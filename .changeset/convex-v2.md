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
- Every generated function declares a real Convex `returns` validator, so clients infer concrete result types instead of `any`
- Shared `BillingContextValue` contract in `core/` — the integration-agnostic seam the widgets will consume
- Subscription plan/group/cycle derivation extracted to `core/subscriptionModel.ts` and shared by the React and Svelte roots
- `Subscription.Grid` honours the root's `columns` prop, so composed and default layouts agree
- React and Svelte subscription widgets now share one plan-target resolver, update-command builder, and optimistic state projector, with lifecycle compensation that restores subscription, scheduled-update, and app-plan state together after failed Creem calls

Breaking changes:

See the [0.3.x migration guide](http://docs.creem.io/code/sdks/convex/migration#upgrading-from-0-3-x) for the complete list of breaking changes and upgrade instructions.
