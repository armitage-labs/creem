import * as components from "creem/models/components";
import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  createFileUpload: (client, parameters, body, options) => {
    const b = decode(
      components.CreateFileUploadRequestEntity$outboundSchema,
      components.CreateFileUploadRequestEntity$inboundSchema,
      body,
    );
    return client.files.createUpload(b, options);
  },
  confirmFileUpload: (client, parameters, body, options) => {
    const p = decode(
      operations.ConfirmFileUploadRequest$outboundSchema,
      operations.ConfirmFileUploadRequest$inboundSchema,
      parameters,
    );
    return client.files.confirmUpload(p, options);
  },
};
