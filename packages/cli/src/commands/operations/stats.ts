import * as operations from "creem/models/operations";
import { decode, type OperationHandler } from "../../lib/operation";

export const handlers: Record<string, OperationHandler> = {
  getMetricsSummary: (client, parameters, body, options) => {
    const p = decode(
      operations.GetMetricsSummaryRequest$outboundSchema,
      operations.GetMetricsSummaryRequest$inboundSchema,
      parameters,
    );
    return client.stats.getSummary(p.currency, p.startDate, p.endDate, p.interval, options);
  },
};
