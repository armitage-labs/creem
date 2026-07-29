import { parseCheckoutSuccessParams } from "../../core/payments.js";

/**
 * Parses Creem's post-checkout query parameters from the current URL and returns
 * them, or `null` when the URL carries none.
 */
export const useCheckoutSuccessParams = (
  search: string = typeof window === "undefined" ? "" : window.location.search,
) => {
  return parseCheckoutSuccessParams(search);
};
