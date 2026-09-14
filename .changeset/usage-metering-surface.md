---
"creem": minor
"@creem_io/cli": minor
---

Add the usage-based billing surface: new `events` group (`ingestEvents` batch usage ingestion, `previewEvents` dry-run, `listEvents` with computed `matched_meters`) and `meters` group (create, list, get, update, preview, preview-stored, per-customer consumed units, archive, unarchive) in the SDK, with matching `creem events …` (ingest, preview, list) and `creem meters …` CLI commands. Ingest responses carry advisory warnings when an event will not aggregate as sent. Customer-credits operations drop their experimental marker.
