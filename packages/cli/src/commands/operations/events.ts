import * as components from "creem/models/components";
import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  ingestUsageEvents: (client, parameters, body, options) => {
    const b = decode(
      components.IngestUsageEventsApiRequestDto$outboundSchema,
      components.IngestUsageEventsApiRequestDto$inboundSchema,
      body,
    );
    return client.events.ingestEvents(b, options);
  },
  listUsageEvents: (client, parameters, body, options) => {
    const p = decode(
      operations.ListUsageEventsRequest$outboundSchema,
      operations.ListUsageEventsRequest$inboundSchema,
      parameters,
    );
    return client.events.listEvents(
      p.meterId,
      p.customerId,
      p.reference,
      p.limit,
      p.startingAfter,
      options,
    );
  },
};
