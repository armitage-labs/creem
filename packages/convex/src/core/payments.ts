import type { CheckoutSuccessParams } from "./types.js";

const getSearchParams = (search: string | URLSearchParams): URLSearchParams => {
  if (search instanceof URLSearchParams) {
    return search;
  }
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw);
};

/**
 * Parse Creem checkout success query parameters from a URL search string.
 * Call on your success page to extract checkout/order/customer/product IDs.
 *
 * @param search - URL search string (e.g. `window.location.search`) or `URLSearchParams` instance
 */
export const parseCheckoutSuccessParams = (
  search: string | URLSearchParams,
): CheckoutSuccessParams => {
  const params = getSearchParams(search);
  return {
    checkoutId: params.get("checkout_id") ?? undefined,
    orderId: params.get("order_id") ?? undefined,
    customerId: params.get("customer_id") ?? undefined,
    productId: params.get("product_id") ?? undefined,
    requestId: params.get("request_id") ?? undefined,
    signature: params.get("signature") ?? undefined,
  };
};

/** Check if the parsed params contain the minimum required fields for a valid checkout success (checkoutId + orderId). */
export const hasCheckoutSuccessParams = (params: CheckoutSuccessParams) =>
  Boolean(params.checkoutId && params.orderId);
