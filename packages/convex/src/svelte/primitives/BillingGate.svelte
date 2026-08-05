<!--
  @component
  Renders `children` only when every action in `requiredActions` is available on
  the snapshot, and `fallback` otherwise.

  This gates UI, not access. Enforce real entitlement on the server.
-->
<script lang="ts">
  /* global $props, $derived */
  import type { Snippet } from "svelte";
  import type { AvailableAction, BillingSnapshot } from "../../core/types.js";
  import { hasBillingActionLocal } from "../../core/display.js";

  interface Props {
    /**
     * Billing state to test the required actions against.
     */
    snapshot?: BillingSnapshot | null;
    /**
     * Every action that must be available before `children` renders.
     */
    requiredActions: AvailableAction | AvailableAction[];
    /**
     * Rendered when all required actions are available.
     */
    children?: Snippet;
    /**
     * Rendered when they are not.
     */
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
