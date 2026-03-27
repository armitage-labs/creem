import type { BillingSnapshot } from "../../core/types.js";

export const ScheduledChangeBanner = ({
  snapshot,
  className = "",
  isLoading = false,
  onResume,
}: {
  snapshot?: BillingSnapshot | null;
  className?: string;
  isLoading?: boolean;
  onResume?: () => void;
}) => {
  if (!snapshot?.metadata || snapshot.metadata.cancelAtPeriodEnd !== true) {
    return null;
  }

  const currentPeriodEnd =
    typeof snapshot.metadata.currentPeriodEnd === "string"
      ? snapshot.metadata.currentPeriodEnd
      : undefined;

  return (
    <div className={`rounded-xl bg-surface-base p-6 ${className}`}>
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="space-y-2">
          <p className="title-s text-foreground-default">
            Cancellation scheduled
          </p>
          <p className="body-m text-foreground-muted">
            You will continue to have access until the end of your current
            billing period
            {currentPeriodEnd
              ? ` (${new Date(currentPeriodEnd).toLocaleDateString()})`
              : ""}
            .
          </p>
        </div>
        {onResume && (
          <button
            type="button"
            className="button-faded h-8 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={onResume}
          >
            {isLoading ? "Resuming…" : "Undo cancellation"}
          </button>
        )}
      </div>
    </div>
  );
};
