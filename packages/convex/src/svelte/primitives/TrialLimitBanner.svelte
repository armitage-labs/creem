<script lang="ts">
  import type { BillingSnapshot } from "../../core/types.js";

  interface Props {
    snapshot?: BillingSnapshot | null;
    trialEndsAt?: string | null;
    className?: string;
  }

  let { snapshot, trialEndsAt = null, className = "" }: Props = $props();

  const show = $derived(snapshot?.activeCategory === "trial");
  const resolvedTrialEnd = $derived(
    trialEndsAt ??
      (typeof snapshot?.metadata?.trialEnd === "string"
        ? snapshot.metadata.trialEnd
        : null),
  );
</script>

{#if show}
  <div
    class={`rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 ${className}`}
  >
    Trial plan active
    {#if resolvedTrialEnd}
      until {new Date(resolvedTrialEnd).toLocaleDateString()}.
    {:else}
      . Upgrade before your trial ends to avoid interruptions.
    {/if}
  </div>
{/if}
