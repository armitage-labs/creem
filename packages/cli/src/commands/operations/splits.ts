import * as components from "creem/models/components";
import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  createSplit: (client, parameters, body, options) => {
    const b = decode(
      components.CreateSplitRequestEntity$outboundSchema,
      components.CreateSplitRequestEntity$inboundSchema,
      body,
    );
    return client.splits.create(b, options);
  },
  listSplits: (client, parameters, body, options) => {
    const p = decode(
      operations.ListSplitsRequest$outboundSchema,
      operations.ListSplitsRequest$inboundSchema,
      parameters,
    );
    return client.splits.list(p.pageNumber, p.pageSize, options);
  },
  retrieveSplit: (client, parameters, body, options) => {
    const p = decode(
      operations.RetrieveSplitRequest$outboundSchema,
      operations.RetrieveSplitRequest$inboundSchema,
      parameters,
    );
    return client.splits.retrieve(p.id, options);
  },
  deleteSplit: (client, parameters, body, options) => {
    const p = decode(
      operations.DeleteSplitRequest$outboundSchema,
      operations.DeleteSplitRequest$inboundSchema,
      parameters,
    );
    return client.splits.delete(p.id, options);
  },
};
