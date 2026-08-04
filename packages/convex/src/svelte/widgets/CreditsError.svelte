<script lang="ts">
  import { getCreditsContext } from "./creditsContext.js";

  interface Props {
    /** Error container CSS class. */
    class?: string;
  }

  let {
    class: className = "body-m radius-m border border-error-border-subtle bg-error-surface-subtle px-3 py-2 text-error-foreground-default",
  }: Props = $props();

  const credits = getCreditsContext();
</script>

{#if credits.error}
  <div class={className}>{credits.error}</div>
{/if}
