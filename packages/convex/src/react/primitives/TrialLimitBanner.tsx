import type { BillingSnapshot } from "../../core/types.js";

export const TrialLimitBanner = ({
  snapshot,
  trialEndsAt,
  className = "",
}: {
  snapshot?: BillingSnapshot | null;
  trialEndsAt?: string | null;
  className?: string;
}) => {
  if (snapshot?.activeCategory !== "trial") {
    return null;
  }

  const resolvedTrialEnd =
    trialEndsAt ??
    (typeof snapshot.metadata?.trialEnd === "string"
      ? snapshot.metadata.trialEnd
      : null);

  return (
    <div
      className={`rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 ${className}`}
    >
      Trial plan active
      {resolvedTrialEnd
        ? ` until ${new Date(resolvedTrialEnd).toLocaleDateString()}.`
        : ". Upgrade before your trial ends to avoid interruptions."}
    </div>
  );
};
