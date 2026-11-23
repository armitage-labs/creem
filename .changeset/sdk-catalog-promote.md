---
"creem": minor
---

New method `catalog.promote` copies the store's test catalog (meters and products) into live, paired by `externalId` (`POST /v1/catalog/promote`). Send `dryRun: true` to preview it, follow `nextCursor` until it is `null`, and send `force: true` to write even when the check before the first write refused an item. Each item reports a `result` (`created`, `updated`, `unchanged`, `needs_key`, `conflict`, `failed`, `blocked`, `not_written`), with `candidates`, `proposedExternalId` and `featureCandidates` for pairing. The MCP server gets a `catalog-promote` tool. The select unions and the response's `validation` have their own names (`CatalogPromoteSelectRequestDtoMeters`, `CatalogPromoteSelectRequestDtoProducts`, their `…All` enums, `CatalogPromoteValidationResponseDto`). A meter write's `changes` can now carry `status`, only on a write promote makes.
