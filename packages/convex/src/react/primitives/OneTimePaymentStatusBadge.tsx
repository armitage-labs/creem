import type { OneTimePaymentStatus } from "../../core/types.js";

const labels: Record<OneTimePaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

export const OneTimePaymentStatusBadge = ({
  status,
  className = "",
}: {
  status: OneTimePaymentStatus;
  className?: string;
}) => {
  return <span className={className}>{labels[status]}</span>;
};
