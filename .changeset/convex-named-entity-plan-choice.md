---
"@creem_io/convex": minor
---

Bill a named entity, and choose a plan from a single choice.

- `<Subscription.Root entityId>` bills that entity instead of the caller's
  default one, for example an organization the user administers without having
  switched to it. The generated `uiModel` and `checkouts.create` take an
  optional `entityId` and pass it to the resolver as its new second argument,
  `ApiResolveRequest`; the resolver authorizes it like its default entity. A
  call that names an entity fails when the resolver returns another one, so a
  resolver written before this option never bills the wrong entity. With
  `entityId` set, the root offers only new checkouts. `checkoutCreateArgs` is
  unchanged, so custom wrappers never take the entity from the browser.
- `<Subscription.Root layout="choice">` and the new `PlanChoice` primitive show
  the plans as one radio list with each plan's price and one "Continue to
  checkout" button, in React and Svelte, with `unstyled` and class props for
  styling. New labels: `subscription.continueToCheckout` and
  `subscription.choosePlan`.
