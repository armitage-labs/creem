<script lang="ts">
  /* global $props, $state */
  import type { Snippet } from "svelte";

  interface Props {
    href?: string;
    disabled?: boolean;
    className?: string;
    onOpenPortal?: () => Promise<void> | void;
    children?: Snippet;
  }

  let {
    href = undefined,
    disabled = false,
    className = "",
    onOpenPortal,
    children,
  }: Props = $props();

  let isLoading = $state(false);

  const handleClick = async () => {
    if (disabled || isLoading || !onOpenPortal) return;
    isLoading = true;
    try {
      await onOpenPortal();
    } finally {
      isLoading = false;
    }
  };
</script>

{#if onOpenPortal}
  <button
    type="button"
    class={`${className || "button-outline"} disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer`}
    {disabled}
    onclick={handleClick}
  >
    {#if children}
      {@render children()}
    {:else}
      {isLoading ? "Loading..." : "Manage billing"}
    {/if}
  </button>
{:else}
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    class={`${className || "button-outline"}`}
  >
    {#if children}
      {@render children()}
    {:else}
      Manage billing
    {/if}
  </a>
{/if}
