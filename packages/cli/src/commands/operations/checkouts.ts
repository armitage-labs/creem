import * as components from "creem/models/components";
import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  retrieveCheckout: (client, parameters, body, options) => {
    const p = decode(
      operations.RetrieveCheckoutRequest$outboundSchema,
      operations.RetrieveCheckoutRequest$inboundSchema,
      parameters,
    );
    return client.checkouts.retrieve(p.checkoutId, options);
  },
  createCheckout: (client, parameters, body, options) => {
    const b = decode(
      components.CreateCheckoutRequest$outboundSchema,
      components.CreateCheckoutRequest$inboundSchema,
      body,
    );
    return client.checkouts.create(b, options);
  },
};
