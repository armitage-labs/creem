import * as components from "creem/models/components";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  validateCatalog: (client, parameters, body, options) => {
    const request = decode(
      components.CatalogValidateRequestDto$outboundSchema,
      components.CatalogValidateRequestDto$inboundSchema,
      body,
    );
    return client.catalog.validate(request, options);
  },
  // One page of promote. `creem catalog promote` itself runs every page and the
  // interactive flow (commands/catalog.ts); this mapping keeps the SDK call typed.
  promoteCatalog: (client, parameters, body, options) => {
    const request = decode(
      components.CatalogPromoteRequestDto$outboundSchema,
      components.CatalogPromoteRequestDto$inboundSchema,
      body,
    );
    return client.catalog.promote(
      { dryRun: parameters.dryRun === true ? true : undefined, catalogPromoteRequestDto: request },
      options,
    );
  },
};
