import {
  defaultBillingLabels,
  type BillingDateFormatInput,
  type BillingLabels,
} from "../../core/i18n.js";

/**
 * Notice for a scheduled cancellation or an app-side period-end update.
 *
 * Inside a connected provider, pass `subscriptionId` and the widget derives the
 * period, the pending update, its label, and the undo/resume handlers from the
 * billing model. The remaining props are overrides for unconnected use.
 */
export const ScheduledChangeBanner = ({
  cancelAtPeriodEnd = false,
  currentPeriodEnd = null,
  scheduledUpdate = null,
  className = "",
  isLoading = false,
  onResume,
  onUndoUpdate,
  scheduledUpdateLabel,
  labels = defaultBillingLabels,
  formatDate,
}: {
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  scheduledUpdate?: { effectiveAt?: unknown } | null;
  className?: string;
  isLoading?: boolean;
  onResume?: () => void;
  onUndoUpdate?: () => void;
  scheduledUpdateLabel?: string | null;
  labels?: BillingLabels;
  formatDate?: (input: BillingDateFormatInput) => string;
}) => {
  const hasScheduledUpdate = scheduledUpdate != null;
  if (!cancelAtPeriodEnd && !hasScheduledUpdate) {
    return null;
  }

  const resolvedPeriodEnd =
    hasScheduledUpdate && typeof scheduledUpdate.effectiveAt === "string"
      ? scheduledUpdate.effectiveAt
      : currentPeriodEnd;
  const formattedPeriodEnd = resolvedPeriodEnd
    ? (formatDate ?? (({ date }) => date.toLocaleDateString()))({
        date: new Date(resolvedPeriodEnd),
      })
    : undefined;

  return (
    <div className={`rounded-xl bg-surface-base p-6 ${className}`}>
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="space-y-2">
          <p className="title-s text-foreground-default">
            {hasScheduledUpdate
              ? labels.scheduledChange.updateScheduled
              : labels.scheduledChange.cancellationScheduled}
          </p>
          <p className="body-m text-foreground-muted">
            {hasScheduledUpdate
              ? labels.scheduledChange.updateAtPeriodEnd(formattedPeriodEnd)
              : labels.scheduledChange.accessUntilPeriodEnd(formattedPeriodEnd)}
          </p>
          {hasScheduledUpdate && scheduledUpdateLabel && (
            <p className="label-m text-foreground-default">
              {labels.scheduledChange.targetUpdate(scheduledUpdateLabel)}
            </p>
          )}
        </div>
        {hasScheduledUpdate && onUndoUpdate ? (
          <button
            type="button"
            className="button-faded h-8 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={onUndoUpdate}
          >
            {isLoading
              ? labels.scheduledChange.resuming
              : labels.scheduledChange.undoUpdate}
          </button>
        ) : !hasScheduledUpdate && onResume ? (
          <button
            type="button"
            className="button-faded h-8 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={onResume}
          >
            {isLoading
              ? labels.scheduledChange.resuming
              : labels.scheduledChange.undoCancellation}
          </button>
        ) : null}
      </div>
    </div>
  );
};
