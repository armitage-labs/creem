---
"@creem_io/convex": patch
---

Send period-end plan and unit changes to Creem before the renewal. The
scheduled job used to run exactly at `currentPeriodEnd`, the moment Creem
charges the renewal, so a downgrade could miss its own renewal and bill the old
product or unit count for one more period. It now runs one hour earlier (or
immediately when less than an hour remains), still with `proration-none`, so
the change charges and refunds nothing and the renewal bills the new product or
count. The scheduled update's `effectiveAt` stays the period end, and changes
to an app-owned plan still apply at the period end. The lead time is exported as
`DEFAULT_PERIOD_END_UPDATE_LEAD_MS` and can be set with the new
`periodEndUpdateLeadMs` option of `new Creem(...)`, which rejects negative
values.
