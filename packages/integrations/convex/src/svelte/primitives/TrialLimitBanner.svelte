<!--
  @component
  Page-level notice that the entity is on a trial.

  `Subscription.Root` already shows a countdown badge on the active plan card, so
  reach for this banner where no pricing card renders, such as an app shell or
  dashboard header. Renders nothing when no subscription is trialing.
-->
<script lang="ts">
  import type { BillingSnapshot } from "../../core/types.js";
  import {
    defaultBillingLabels,
    type BillingDateFormatInput,
    type BillingLabels,
  } from "../../core/i18n.js";

  interface Props {
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
    class?: string;
    /**
     * Text overrides, read from `labels.trialBanner`.
     */
    labels?: BillingLabels;
    /**
     * Date formatter for the trial end date; pass the provider's formatter to
     * keep formatting consistent.
     */
    formatDate?: (input: BillingDateFormatInput) => string;
  }

  let {
    snapshot,
    trialEndsAt = null,
    class: className = "",
    labels = defaultBillingLabels,
    formatDate = undefined,
  }: Props = $props();

  const trialSubscription = $derived(
    // `endedAt` matters here: a trial that lapses without converting keeps
    // `status: "trialing"` on the row, so matching on status alone would
    // announce "Trial plan active until <past date>" forever.
    snapshot?.subscriptions.find(
      (subscription) =>
        subscription.status === "trialing" && !subscription.endedAt,
    ) ?? null,
  );
  const resolvedTrialEnd = $derived(
    trialEndsAt ?? trialSubscription?.trialEnd ?? null,
  );
  const formattedTrialEnd = $derived.by(() => {
    if (!resolvedTrialEnd) return null;
    const date = new Date(resolvedTrialEnd);
    if (Number.isNaN(date.getTime())) return null;
    return (formatDate ?? (({ date: d }) => d.toLocaleDateString()))({ date });
  });
</script>

{#if trialSubscription}
  <div
    role="status"
    class={`body-m radius-m border border-border-subtle bg-surface-subtle px-4 py-3 text-foreground-default ${className}`}
  >
    {formattedTrialEnd
      ? labels.trialBanner.activeUntil(formattedTrialEnd)
      : labels.trialBanner.active}
  </div>
{/if}
