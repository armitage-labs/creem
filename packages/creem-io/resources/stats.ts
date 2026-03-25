import { RequestFn } from "../types/core";
import { GetStatsSummaryRequest, StatsSummary } from "../types";
import { required, isString, isNumber } from "../validate";

export const statsResource = (request: RequestFn) => ({
  getSummary: (params: GetStatsSummaryRequest) => {
    required(params.currency, "currency");
    isString(params.currency, "currency");
    isNumber(params.startDate, "startDate");
    isNumber(params.endDate, "endDate");
    isString(params.interval, "interval");

    return request<StatsSummary>("GET", "/v1/stats/summary", undefined, {
      currency: params.currency,
      start_date: params.startDate,
      end_date: params.endDate,
      interval: params.interval,
    });
  },
});
