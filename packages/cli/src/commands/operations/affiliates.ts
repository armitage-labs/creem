import * as components from "creem/models/components";
import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  createAffiliateInvite: (client, parameters, body, options) => {
    const b = decode(
      components.CreateAffiliateInviteRequestEntity$outboundSchema,
      components.CreateAffiliateInviteRequestEntity$inboundSchema,
      body,
    );
    return client.affiliates.createInvite(b, options);
  },
  listAffiliateInvites: (client, parameters, body, options) => {
    const p = decode(
      operations.ListAffiliateInvitesRequest$outboundSchema,
      operations.ListAffiliateInvitesRequest$inboundSchema,
      parameters,
    );
    return client.affiliates.listInvites(p.pageNumber, p.pageSize, options);
  },
  listAffiliates: (client, parameters, body, options) => {
    const p = decode(
      operations.ListAffiliatesRequest$outboundSchema,
      operations.ListAffiliatesRequest$inboundSchema,
      parameters,
    );
    return client.affiliates.list(p.pageNumber, p.pageSize, options);
  },
  retrieveAffiliate: (client, parameters, body, options) => {
    const p = decode(
      operations.RetrieveAffiliateRequest$outboundSchema,
      operations.RetrieveAffiliateRequest$inboundSchema,
      parameters,
    );
    return client.affiliates.retrieve(p.id, options);
  },
  listAffiliateCommissions: (client, parameters, body, options) => {
    const p = decode(
      operations.ListAffiliateCommissionsRequest$outboundSchema,
      operations.ListAffiliateCommissionsRequest$inboundSchema,
      parameters,
    );
    return client.affiliates.listCommissions(p.id, p.status, p.pageNumber, p.pageSize, options);
  },
};
