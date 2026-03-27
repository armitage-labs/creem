import {
  hasCheckoutSuccessParams,
  parseCheckoutSuccessParams,
} from "../../core/payments.js";
import type { CheckoutSuccessParams } from "../../core/types.js";

export const CheckoutSuccessSummary = ({
  params,
  search = "",
  className = "",
}: {
  params?: CheckoutSuccessParams;
  search?: string;
  className?: string;
}) => {
  const fromSearch = parseCheckoutSuccessParams(search);
  const parsed = params ?? fromSearch;
  if (!hasCheckoutSuccessParams(parsed)) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 ${className}`}
    >
      <p className="font-medium">Checkout completed successfully.</p>
      <ul className="mt-2 space-y-1">
        {parsed.checkoutId && <li>Checkout: {parsed.checkoutId}</li>}
        {parsed.orderId && <li>Order: {parsed.orderId}</li>}
        {parsed.customerId && <li>Customer: {parsed.customerId}</li>}
        {parsed.productId && <li>Product: {parsed.productId}</li>}
        {parsed.requestId && <li>Request: {parsed.requestId}</li>}
      </ul>
    </div>
  );
};
