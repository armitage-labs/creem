import type { BillingSnapshot } from "../../core/types.js";
import {
  defaultBillingLabels,
  type BillingDateFormatInput,
  type BillingLabels,
} from "../../core/i18n.js";

/**
 * Page-level notice that the entity is on a trial.
 *
 * `Subscription.Root` already shows a countdown badge on the active plan card.
 * Use this banner where no pricing card renders, such as an app shell or
 * dashboard header.
 *
 * Renders nothing when no subscription is trialing.
 *
 * @example
 * ```tsx
 * <TrialLimitBanner snapshot={snapshot} />
 * ```
 */
export const TrialLimitBanner = ({
  snapshot,
  trialEndsAt,
  className = "",
  labels = defaultBillingLabels,
  formatDate,
}: {
  snapshot?: BillingSnapshot | null;
  /** Override the trial end date resolved from the snapshot. */
  trialEndsAt?: string | null;
  className?: string;
  labels?: BillingLabels;
  formatDate?: (input: BillingDateFormatInput) => string;
}) => {
  const trialSubscription = snapshot?.subscriptions.find(
    (subscription) => subscription.status === "trialing",
  );

  if (!trialSubscription) {
    return null;
  }

  const resolvedTrialEnd = trialEndsAt ?? trialSubscription.trialEnd ?? null;
  const endDate = resolvedTrialEnd ? new Date(resolvedTrialEnd) : null;
  const formattedTrialEnd =
    endDate && !Number.isNaN(endDate.getTime())
      ? (formatDate ?? (({ date }) => date.toLocaleDateString()))({
          date: endDate,
        })
      : null;

  return (
    <div
      role="status"
      className={`body-m radius-m border border-border-subtle bg-surface-subtle px-4 py-3 text-foreground-default ${className}`}
    >
      {formattedTrialEnd
        ? labels.trialBanner.activeUntil(formattedTrialEnd)
        : labels.trialBanner.active}
    </div>
  );
};
