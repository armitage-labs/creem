<script lang="ts">
  import { getCreditsContext } from "./creditsContext.js";

  interface Props {
    /** Wrapper CSS class. */
    class?: string;
    /** Numeric amount CSS class. */
    amountClass?: string;
    /** Unit label CSS class. */
    unitClass?: string;
  }

  let {
    class: className = "flex items-baseline gap-2",
    amountClass = "heading-s tabular-nums text-foreground-default",
    unitClass = "label-m text-foreground-muted",
  }: Props = $props();

  const credits = getCreditsContext();
</script>

{#if credits.loading && credits.balance === null}
  <div class="body-m py-3 text-foreground-muted">{credits.labels.credits.loading}</div>
{:else}
  <div class={className}>
    <span class={amountClass}>{credits.balance ?? "-"}</span>
    <span class={unitClass}>{credits.unitLabel}</span>
  </div>
{/if}
