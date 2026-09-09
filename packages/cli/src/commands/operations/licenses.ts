import * as components from "creem/models/components";
import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  activateLicense: (client, parameters, body, options) => {
    const b = decode(
      components.ActivateLicenseRequestEntity$outboundSchema,
      components.ActivateLicenseRequestEntity$inboundSchema,
      body,
    );
    return client.licenses.activate(b, options);
  },
  deactivateLicense: (client, parameters, body, options) => {
    const b = decode(
      components.DeactivateLicenseRequestEntity$outboundSchema,
      components.DeactivateLicenseRequestEntity$inboundSchema,
      body,
    );
    return client.licenses.deactivate(b, options);
  },
  validateLicense: (client, parameters, body, options) => {
    const b = decode(
      components.ValidateLicenseRequestEntity$outboundSchema,
      components.ValidateLicenseRequestEntity$inboundSchema,
      body,
    );
    return client.licenses.validate(b, options);
  },
  listLicenseInstances: (client, parameters, body, options) => {
    const p = decode(
      operations.ListLicenseInstancesRequest$outboundSchema,
      operations.ListLicenseInstancesRequest$inboundSchema,
      parameters,
    );
    return client.licenses.listInstances(p.id, p.pageNumber, p.pageSize, options);
  },
};
