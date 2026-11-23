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
};
