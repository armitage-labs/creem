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
  /**
   * Billing state to read the trialing subscription from; the banner renders
   * nothing when none is trialing.
   */
  snapshot?: BillingSnapshot | null;
  /** Override the trial end date resolved from the snapshot. */
  trialEndsAt?: string | null;
  /**
   * CSS class for the wrapper element.
   */
  className?: string;
  /**
   * Text overrides, read from `labels.trialBanner`.
   */
  labels?: BillingLabels;
  /**
   * Date formatter for the trial end date; pass the provider's formatter to
   * keep formatting consistent.
   */
  formatDate?: (input: BillingDateFormatInput) => string;
}) => {
  // `endedAt` matters here: a trial that lapses without converting keeps
  // `status: "trialing"` on the row, so matching on status alone would announce
  // "Trial plan active until <past date>" forever.
  const trialSubscription = snapshot?.subscriptions.find(
    (subscription) =>
      subscription.status === "trialing" && !subscription.endedAt,
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
