---
"@creem_io/cli": minor
"creem": minor
---

Add `creem listen`: receive your store's webhooks on your machine without a tunnel or a deploy. The command creates a temporary `cli` delivery-mode endpoint, forwards each event to a local URL with the real body and `creem-signature` header, reports the local result back to Creem, and deletes the endpoint on exit. New SDK methods `webhooks.listPendingEvents` and `webhooks.acknowledgeEvent`, plus `delivery_mode` on webhook create/read, back it (`creem webhooks pending` / `creem webhooks ack` expose them directly).

Validate pending-feed limits as integers from 1 to 100, report the stored first acknowledgment outcome, and drain all pending pages with `--once`.
