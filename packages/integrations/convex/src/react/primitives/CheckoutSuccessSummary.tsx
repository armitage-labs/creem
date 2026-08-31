import {
  hasCheckoutSuccessParams,
  parseCheckoutSuccessParams,
} from "../../core/payments.js";
import type { CheckoutSuccessParams } from "../../core/types.js";
import { defaultBillingLabels, type BillingLabels } from "../../core/i18n.js";

/**
 * Success banner for the post-checkout return page.
 *
 * Parses Creem's query parameters from the URL unless you pass `params` or
 * `search` explicitly.
 */
export const CheckoutSuccessSummary = ({
  params,
  search = "",
  className = "",
  labels = defaultBillingLabels,
}: {
  params?: CheckoutSuccessParams;
  search?: string;
  className?: string;
  labels?: BillingLabels;
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
      <p className="font-medium">{labels.checkout.success}</p>
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
