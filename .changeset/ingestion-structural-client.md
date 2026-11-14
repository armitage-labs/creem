---
"@creem_io/ingestion": patch
---

`Ingestion({ client })` accepts a client from another `creem` major. `IngestionConfig` takes the client's type as an optional parameter, `IngestionConfig<Client extends IngestionClient = Creem>`, and `Ingestion()` infers it, so any client with `events.ingestEvents` (the new `IngestionClient` type) fits. Existing code doesn't change: `IngestionConfig["client"]` is still `Creem`. To annotate a config that holds a client from another major, name its type: `IngestionConfig<typeof client>`.
