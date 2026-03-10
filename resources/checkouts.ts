import { RequestFn } from "../types/core";
import { CreateCheckoutRequest, GetCheckoutRequest, Checkout } from "../types";
import { required, isString, isNumber, isArray } from "../validate";

export const checkoutsResource = (request: RequestFn) => ({
  get: (params: GetCheckoutRequest) => {
    // TODO: Return object has types completely different from create checkout. Check.
    required(params.checkoutId, "checkoutId");
    isString(params.checkoutId, "checkoutId");

    return request<Checkout>("GET", "/v1/checkouts", undefined, {
      checkout_id: params.checkoutId,
    });
  },
  create: (params: CreateCheckoutRequest) => {
    // TODO: Return object is not compatible with types. Like customer, customfields, etc not in object. Check.
    isString(params.requestId, "requestId");

    required(params.productId, "productId");
    isString(params.productId, "productId");

    isNumber(params.units, "units");
    isString(params.discountCode, "discountCode");
    // Complex object validation for customer skipped for brevity, but good to add
    isArray(params.customFields, "customFields");
    isArray(params.customField, "customField");
    isString(params.successUrl, "successUrl");

    return request<Checkout>("POST", "/v1/checkouts", {
      request_id: params.requestId,
      product_id: params.productId,
      units: params.units,
      discount_code: params.discountCode,
      customer: params.customer,
      custom_fields: params.customFields,
      custom_field: params.customField,
      success_url: params.successUrl,
      metadata: params.metadata,
    });
  },
});
