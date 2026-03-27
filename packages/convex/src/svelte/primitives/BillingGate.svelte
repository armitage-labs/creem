<script lang="ts">
  /* global $props, $derived */
  import type { Snippet } from "svelte";
  import type { AvailableAction, BillingSnapshot } from "../../core/types.js";
  import { hasBillingActionLocal } from "./shared.js";

  interface Props {
    snapshot?: BillingSnapshot | null;
    requiredActions: AvailableAction | AvailableAction[];
    children?: Snippet;
    fallback?: Snippet;
  }

  let { snapshot, requiredActions, children, fallback }: Props = $props();

  const actions = $derived(
    Array.isArray(requiredActions) ? requiredActions : [requiredActions],
  );
  const canRender = $derived(
    snapshot != null && actions.every((action) => hasBillingActionLocal(snapshot, action)),
  );
</script>

{#if canRender}
  {@render children?.()}
{:else}
  {@render fallback?.()}
{/if}
