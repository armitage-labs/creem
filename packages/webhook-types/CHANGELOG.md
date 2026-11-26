# Changelog

## 2.0.0

### Major Changes

- 2020a54: Webhook payload value fields accept values Creem adds later. A refund's `reason`, a subscription's `status` and `collection_method`, a product's `billing_type`, every `mode`, and the other value fields are now typed as their known values or any other string (the new `OpenValue<Known>` type). The parser already passed such values through unchanged; the types now say so, instead of telling your handler that a value like a new refund reason can't happen.

  A `switch` over the known values of one of these fields is no longer exhaustive. A `never` exhaustiveness check (`const unhandled: never = reason`) no longer compiles, and neither does a function that returns from every case when its return type is declared or `noImplicitReturns` is on; add a `default` branch. With an inferred return type such a function compiles and its return type gains `undefined`. A handler that returns nothing still compiles without one, and a value added later then matches no case, so check those switches too:

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

## 1.0.1

### Patch Changes

- 3cf0b89: Include consistent MIT licensing, repository metadata, release documentation,
  and explicit workspace dependency references in published package artifacts,
  and make dual CommonJS/ESM type entrypoints resolve to their matching declaration
  format.

All notable changes to `@creem_io/webhook-types` will be documented here. This
package uses [Changesets](https://github.com/changesets/changesets) for future
releases.

## 1.0.0

- Initial public release of shared Creem webhook entities, normalized event
  types, type guards, signature generation, and payload parsing utilities.
