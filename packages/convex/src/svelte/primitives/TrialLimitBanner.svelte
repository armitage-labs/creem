<script lang="ts">
  import type { BillingSnapshot } from "../../core/types.js";
  import {
    defaultBillingLabels,
    type BillingDateFormatInput,
    type BillingLabels,
  } from "../../core/i18n.js";

  interface Props {
    snapshot?: BillingSnapshot | null;
    /** Override the trial end date resolved from the snapshot. */
    trialEndsAt?: string | null;
    class?: string;
    labels?: BillingLabels;
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
    snapshot?.subscriptions.find(
      (subscription) => subscription.status === "trialing",
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
