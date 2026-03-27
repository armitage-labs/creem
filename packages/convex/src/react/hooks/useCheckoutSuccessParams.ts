import { parseCheckoutSuccessParams } from "../../core/payments.js";

export const useCheckoutSuccessParams = (
  search: string = typeof window === "undefined" ? "" : window.location.search,
) => {
  return parseCheckoutSuccessParams(search);
};
