---
"@creem_io/cli": minor
---

Add `creem migrate paddle`, which copies a Paddle Billing catalog into Creem: each USD or EUR price becomes a product keyed by its Paddle price id, a product with two or more subscription prices becomes a product group, and discounts become discount codes. The Paddle API key (`--paddle-key` or `PADDLE_API_KEY`) stays on your machine; `--paddle-environment` picks sandbox or production, and `--include-archived` writes archived prices as archived products. Country prices, other currencies, unsupported billing cycles, per-seat discounts and quantity limits are reported, never converted. Creem checks the plan with a dry run before anything is written, and a second run writes nothing when nothing changed.
