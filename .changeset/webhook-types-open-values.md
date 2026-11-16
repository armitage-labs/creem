---
"@creem_io/webhook-types": major
"@creem_io/better-auth": major
"@creem_io/nextjs": minor
---

Webhook payload value fields accept values Creem adds later. A refund's `reason`, a subscription's `status` and `collection_method`, a product's `billing_type`, every `mode`, and the other value fields are now typed as their known values or any other string (the new `OpenValue<Known>` type). The parser already passed such values through unchanged; the types now say so, instead of telling your handler that a value like a new refund reason can't happen.

A `switch` over the known values of one of these fields is no longer exhaustive. A `never` exhaustiveness check (`const unhandled: never = reason`) and a function that returns from every case no longer compile; add a `default` branch. A handler that returns nothing still compiles without one, and a value added later then matches no case, so check those switches too:

```ts
onRefundCreated: async ({ reason }) => {
  switch (reason) {
    case "duplicate":
    case "fraudulent":
      // ...
      break;
    default:
    // a reason Creem added after this version
  }
};
```

Comparisons with a known value still compile, and editors still suggest the known values. The flip side: a misspelled comparison (`reason === "duplicat"`) compiles too. The fields that identify an event or an object (`eventType`, `object`) stay closed. `@creem_io/better-auth` and `@creem_io/nextjs` re-export these types, so their webhook callback parameters change the same way; for `@creem_io/better-auth` this ships in the same major as `creem` 2.
