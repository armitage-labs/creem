import { useMemo } from "react";
import type { PaymentSnapshot } from "../../core/types.js";
import { defaultBillingLabels, type BillingLabels } from "../../core/i18n.js";

/**
 * Warning banner for a pending, refunded, or partially refunded payment.
 */
export const PaymentWarningBanner = ({
  payment,
  className = "",
  labels = defaultBillingLabels,
}: {
  payment?: PaymentSnapshot | null;
  className?: string;
  labels?: BillingLabels;
}) => {
  const activePayment = payment ?? null;

  const message = useMemo(() => {
    if (!activePayment || activePayment.status === "paid") return null;
    if (activePayment.status === "pending")
      return labels.paymentWarning.pending;
    if (activePayment.status === "partially_refunded")
      return labels.paymentWarning.partiallyRefunded;
    return labels.paymentWarning.refunded;
  }, [activePayment, labels]);

  if (!message) return null;

  return (
    <div
      className={`rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 ${className}`}
    >
      {message}
    </div>
  );
};
