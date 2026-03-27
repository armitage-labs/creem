<script lang="ts">
  /* global $props, $derived */
  import type { BillingSnapshot } from "../../core/types.js";

  interface Props {
    snapshot?: BillingSnapshot | null;
    className?: string;
    isLoading?: boolean;
    onResume?: () => void;
  }

  let { snapshot = null, className = "", isLoading = false, onResume = undefined }: Props = $props();

  const show = $derived(snapshot?.metadata?.cancelAtPeriodEnd === true);
  const currentPeriodEnd = $derived(
    typeof snapshot?.metadata?.currentPeriodEnd === "string"
      ? snapshot.metadata.currentPeriodEnd
      : undefined,
  );
</script>

{#if show}
  <div
    class={`rounded-xl bg-surface-base p-6 ${className}`}
  >
    <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-4">
      <div class="space-y-2">
        <p class="title-s text-foreground-default">Cancellation scheduled</p>
        <p class="body-m text-foreground-muted">
          You will continue to have access until the end of your current billing period
          {#if currentPeriodEnd} ({new Date(currentPeriodEnd).toLocaleDateString()}){/if}.
        </p>
      </div>
      {#if onResume}
        <button
          type="button"
          class="button-faded h-8 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
          onclick={onResume}
        >
          {isLoading ? "Resuming…" : "Undo cancellation"}
        </button>
      {/if}
    </div>
  </div>
{/if}
