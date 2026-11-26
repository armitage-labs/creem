import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  listProductGroups: (client, parameters, body, options) => {
    const p = decode(
      operations.ListProductGroupsRequest$outboundSchema,
      operations.ListProductGroupsRequest$inboundSchema,
      parameters,
    );
    return client.productGroups.list(p, options);
  },
  getProductGroup: (client, parameters, body, options) => {
    const p = decode(
      operations.GetProductGroupRequest$outboundSchema,
      operations.GetProductGroupRequest$inboundSchema,
      parameters,
    );
    return client.productGroups.get(p, options);
  },
};
