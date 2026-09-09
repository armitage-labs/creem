<script lang="ts">
  import { getCreditsContext } from "./creditsContext.js";

  interface Props {
    /** Title CSS class. */
    class?: string;
    /** Optional custom title content. */
    children?: import("svelte").Snippet;
  }

  let { class: className = "title-s text-foreground-default", children }: Props =
    $props();
  const credits = getCreditsContext();
</script>

<h3 class={className}>
  {#if children}
    {@render children()}
  {:else}
    {credits.labels.credits.title}
  {/if}
</h3>
