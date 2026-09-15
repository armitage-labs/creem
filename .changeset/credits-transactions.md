---
"creem": minor
"@creem_io/cli": minor
---

Customer credits: the transactions surface.

Four new operations for working with credit transactions directly —
double-entry postings across accounts, lookup, listing, and reversal:

- `POST /v1/customer-credits/transactions` — post a balanced multi-entry
  transaction (each entry names an account, a side, and an amount; total
  debits must equal total credits). CLI: `creem customer-credits
  post-transaction`.
- `GET /v1/customer-credits/transactions?reference=` — list transactions by
  your reference. CLI: `creem customer-credits transactions`.
- `GET /v1/customer-credits/transactions/{id}` — retrieve one. CLI:
  `creem customer-credits get-transaction`.
- `POST /v1/customer-credits/transactions/{id}/reverse` — reverse one. CLI:
  `creem customer-credits reverse-transaction`.
