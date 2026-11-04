---
"@creem_io/ingestion": patch
---

`IngestionConfig.client` accepts any client with `events.ingestEvents` (the new `IngestionClient` type) instead of the whole `Creem` class, so a client from `creem` 1.x or 2.x both fit.
