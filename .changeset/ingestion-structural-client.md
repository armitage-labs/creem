---
"@creem_io/ingestion": minor
---

Ingestion moves to `creem` 2, so this release breaks code that names the SDK client through ingestion's types. `IngestionConfig` defaults to `IngestionConfig<Creem>` of `creem` 2, and `config.client` now has the 2.0 method shapes.

- An app that keeps `creem` 1.x and annotates `const config: IngestionConfig = { client }` no longer compiles: the 1.x client is a different class. Annotate with the client's own type, `IngestionConfig<typeof client>`, or leave the annotation off and let `Ingestion()` infer it.
- Code that calls SDK methods through `config.client` uses the 2.0 calls, which take one request object: `config.client?.customers.retrieve({ customerId: "cust_1" })` instead of `retrieve("cust_1")`. See the `creem` 2.0 migration guide.

`Ingestion({ client })` itself accepts a client from either major: it needs only `events.ingestEvents` (the new `IngestionClient` type), and `IngestionConfig<Client extends IngestionClient = Creem>` takes the client's type as an optional parameter.
