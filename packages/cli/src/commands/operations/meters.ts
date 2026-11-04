import * as components from "creem/models/components";
import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  createMeter: (client, parameters, body, options) => {
    const b = decode(
      components.CreateMeterApiRequestDto$outboundSchema,
      components.CreateMeterApiRequestDto$inboundSchema,
      body,
    );
    return client.meters.createMeter(b, options);
  },
  listMeters: (client, parameters, body, options) => {
    const p = decode(
      operations.ListMetersRequest$outboundSchema,
      operations.ListMetersRequest$inboundSchema,
      parameters,
    );
    return client.meters.listMeters(p, options);
  },
  previewMeter: (client, parameters, body, options) => {
    const b = decode(
      components.PreviewMeterApiRequestDto$outboundSchema,
      components.PreviewMeterApiRequestDto$inboundSchema,
      body,
    );
    return client.meters.previewMeter(b, options);
  },
  getMeter: (client, parameters, body, options) => {
    const p = decode(
      operations.GetMeterRequest$outboundSchema,
      operations.GetMeterRequest$inboundSchema,
      parameters,
    );
    return client.meters.getMeter(p, options);
  },
  updateMeter: (client, parameters, body, options) => {
    const p = decode(
      operations.UpdateMeterRequest$outboundSchema,
      operations.UpdateMeterRequest$inboundSchema,
      { ...parameters, updateMeterApiRequestDto: body },
    );
    return client.meters.updateMeter(p, options);
  },
  previewExistingMeter: (client, parameters, body, options) => {
    const p = decode(
      operations.PreviewExistingMeterRequest$outboundSchema,
      operations.PreviewExistingMeterRequest$inboundSchema,
      parameters,
    );
    return client.meters.previewExistingMeter(p, options);
  },
  getMeterConsumedUnits: (client, parameters, body, options) => {
    const p = decode(
      operations.GetMeterConsumedUnitsRequest$outboundSchema,
      operations.GetMeterConsumedUnitsRequest$inboundSchema,
      parameters,
    );
    return client.meters.getConsumedUnits(p, options);
  },
  archiveMeter: (client, parameters, body, options) => {
    const p = decode(
      operations.ArchiveMeterRequest$outboundSchema,
      operations.ArchiveMeterRequest$inboundSchema,
      parameters,
    );
    return client.meters.archiveMeter(p, options);
  },
  unarchiveMeter: (client, parameters, body, options) => {
    const p = decode(
      operations.UnarchiveMeterRequest$outboundSchema,
      operations.UnarchiveMeterRequest$inboundSchema,
      parameters,
    );
    return client.meters.unarchiveMeter(p, options);
  },
};
