# Changelog

## 0.4.0

### Minor Changes

- 9bf9f20: This is a big feature release with breaking changes.

  Features:
  - i18n support for all billing UI text
  - Usage limits / feature gates (`usageLimits`) with scoped trial expiry and
    `eligibilityScopeId` in the catalog
  - Credits widgets for React and Svelte (`Credits*` components)
  - Billing history widget (`BillingHistory`)
  - Payment recovery primitives (`PaymentRecoveryBanner`,
    `PaymentRecoveryButton`)
  - Provider factories: `createCreemReact` / `createCreemSvelte` with
    `CreemConvexProvider`
  - Subscription widget slots (`SubscriptionGrid`, `SubscriptionGroup`,
    `SubscriptionGroupSelector`, `SubscriptionIntervalSelector`,
    `SubscriptionItem*` slot components, `SubscriptionUnitPicker`)
  - `cancelPendingScheduledSubscriptionUpdates` mutation; scheduled-update
    cancellation integrated into the subscription update flow
  - Product descriptions render markdown tables
  - Hosted docs at docs.creem.io/code/sdks/convex, including an agent-oriented
    Integration Guide with a brownfield migration checklist
  - Entity-scoped Customer Credits helpers for trusted app-owned grants and
    spending
  - Packed-package compatibility audit for the intentional ESM/bundler support
    contract
  - `PlanCatalogEntry.trialDays` declares the length of a Creem-managed trial,
    so the pricing card can offer it before checkout instead of a plain
    "Subscribe". Creem's product API does not expose trial configuration, so
    this mirrors the dashboard until config-as-code can drive both. New
    `BillingLabels.subscription` keys: `startFreeTrial` and `trialDaysFree`.
  - `connectCreemApi(api.billing)` builds the connected widget API from the
    generated exports
  - `@creem_io/convex/core` — a browser-safe, framework-neutral entry for
    catalog and snapshot helpers, so sharing a catalog between server and
    browser code no longer pulls the Creem Node SDK into your bundle
  - Every generated function declares a real Convex `returns` validator, so
    clients infer concrete result types instead of `any`
  - Shared `BillingContextValue` contract in `core/` — the integration-agnostic
    seam the widgets will consume
  - Subscription plan/group/cycle derivation extracted to
    `core/subscriptionModel.ts` and shared by the React and Svelte roots
  - `Subscription.Grid` honours the root's `columns` prop, so composed and
    default layouts agree
  - React and Svelte subscription widgets now share one plan-target resolver,
    update-command builder, and optimistic state projector, with lifecycle
    compensation that restores subscription, scheduled-update, and app-plan
    state together after failed Creem calls

  Fixes:
  - Expired subscriptions kept granting access indefinitely. Terminal statuses
    are now closed out, so access ends when the subscription does. `unpaid` and
    `paused` stay open so payment-recovery UI can still act on them
  - A lapsed trial stayed "active" until some unrelated write happened to re-run
    the query. Trial expiry is now driven by a scheduled mutation, so it reaches
    subscribed clients on time
  - A signed-in customer on the free tier was shown no current plan, and the
    free card offered "Get started" to someone already on it
  - When Creem issued a new customer ID for an entity (test/live switch,
    customer re-created), the stale mapping made every subscription and order
    lookup miss — a paying user saw nothing
  - `subscriptions.getCurrent` threw when a subscription referenced a product
    that had not been synced yet, taking down every query composed on top of it
  - Timestamps from Creem are normalized to UTC on write. Offset-form timestamps
    sorted incorrectly against UTC values, which could misclassify trial expiry
    and webhook staleness
  - Orders arriving without a customer ID were stored where no query could reach
    them; the webhook now fails loudly and Creem retries
  - Resuming a subscription Creem had already ended silently left the UI showing
    an active subscription that did not exist
  - A credit grant with a non-integer amount crashed the refund webhook,
    returning 5xx and putting Creem into a retry loop
  - Checkout buttons stayed enabled while a checkout was in flight, so a second
    click could open a second checkout session

  Upgrading from 0.3.x? Read the
  [migration guide](http://docs.creem.io/code/sdks/convex/migration#upgrading-from-0-3-x)
  — it covers every breaking change, including new required peer dependencies,
  removed primitives, and changed return shapes.

### Patch Changes

- c3be179: Bump creem SDK dependency to 1.6.0

## 0.3.2

### Patch Changes

- bb581ac: Bump creem SDK dependency to 1.5.3

## 0.3.1

### Patch Changes

- a979bc4: Bump creem SDK dependency to 1.5.1

## 0.3.0

Breaking changes

- Update convex-svelte package references to @mmailaender/convex-svelte

## 0.2.0

Features

- Tables in product descriptions

Fix

- Markdown rendering in product descriptions

## 0.1.0

- Initial npm release of this package.
- Convex component for Creem billing:
  - Webhook sync engine (customers, subscriptions, orders, products).
  - `creem.api({ resolve })` convenience exports for common billing flows.
  - Resource namespaces for direct API access (`creem.subscriptions.*`,
    `creem.checkouts.*`, `creem.products.*`, `creem.customers.*`,
    `creem.orders.*`).
- Billing UI helpers:
  - React widgets/primitives (`./react` export).
  - Svelte 5 widgets/primitives (`./svelte` export).
  - Shared styles export (`./styles`).
