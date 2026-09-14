---
"creem": minor
"@creem_io/cli": minor
---

Usage events: customer resolution and a single attribute bag.

- Ingest and preview events now take **exactly one** of `customerId` (the
  Creem customer id, validated to exist) or the new `externalCustomerId`
  (your own id for the customer, resolved via the customer's registered
  `external_id`). Unknown references reject the whole batch with a 422
  naming the offending event.
- Customers gain `external_id` on create, update, and the customer entity
  (unique per store; send `null` on update to clear it). CLI:
  `creem customers create|update --external-id`.
- Preview reports now include the resolved `customer_id` per event.
- **Contract cut on the pre-release usage surface**: the `metadata` field is
  removed from usage events — the server now rejects it with a 422. Put
  event attributes in `properties`, the bag meters aggregate and filter on.
  This surface shipped days ago with zero production adoption, hence the
  minor bump.
