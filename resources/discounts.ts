import { RequestFn } from "../types/core";
import {
  GetDiscountRequest,
  CreateDiscountRequest,
  DeleteDiscountRequest,
  Discount,
} from "../types";
import { required, isString, isNumber, isArray } from "../validate";

export const discountsResource = (request: RequestFn) => ({
  get: (params: GetDiscountRequest) => {
    // TODO: Missing storeId when returning object. Check.
    isString(params.discountId, "discountId");
    isString(params.discountCode, "discountCode");

    if (!params.discountId && !params.discountCode) {
      throw new Error("Either 'discountId' or 'discountCode' must be provided to get a discount.");
    }

    return request<Discount>("GET", "/v1/discounts", undefined, {
      discount_id: params.discountId,
      discount_code: params.discountCode,
    });
  },
  create: (params: CreateDiscountRequest) => {
    required(params.name, "name");
    isString(params.name, "name");

    isString(params.code, "code");
    required(params.type, "type");
    isString(params.type, "type");

    isNumber(params.amount, "amount");
    isString(params.currency, "currency");
    isNumber(params.percentage, "percentage");
    // expiryDate is Date type - skip isString validation
    isNumber(params.maxRedemptions, "maxRedemptions");

    required(params.duration, "duration");
    isString(params.duration, "duration");

    isNumber(params.durationInMonths, "durationInMonths");
    isArray(params.appliesToProducts, "appliesToProducts");

    return request<Discount>("POST", "/v1/discounts", {
      name: params.name,
      code: params.code,
      type: params.type,
      amount: params.amount,
      currency: params.currency,
      percentage: params.percentage,
      expiry_date: params.expiryDate,
      max_redemptions: params.maxRedemptions,
      duration: params.duration,
      duration_in_months: params.durationInMonths,
      applies_to_products: params.appliesToProducts,
    });
  },
  delete: (params: DeleteDiscountRequest) => {
    required(params.discountId, "discountId");
    isString(params.discountId, "discountId");

    return request<Discount>("DELETE", `/v1/discounts/${params.discountId}/delete`);
  },
});
