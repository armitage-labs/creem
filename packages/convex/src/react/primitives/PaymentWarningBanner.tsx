import { useMemo } from "react";
import type { BillingSnapshot, PaymentSnapshot } from "../../core/types.js";

export const PaymentWarningBanner = ({
  snapshot,
  payment,
  className = "",
}: {
  snapshot?: BillingSnapshot | null;
  payment?: PaymentSnapshot | null;
  className?: string;
}) => {
  const activePayment = payment ?? snapshot?.payment ?? null;

  const message = useMemo(() => {
    if (!activePayment || activePayment.status === "paid") return null;
    if (activePayment.status === "pending")
      return "Your payment is pending confirmation. Wait for webhook confirmation before granting permanent access.";
    if (activePayment.status === "partially_refunded")
      return "This payment was partially refunded. Review entitlements that depend on purchase amount.";
    return "This payment was refunded. Access should generally be revoked or downgraded.";
  }, [activePayment]);

  if (!message) return null;

  return (
    <div
      className={`rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 ${className}`}
    >
      {message}
    </div>
  );
};
