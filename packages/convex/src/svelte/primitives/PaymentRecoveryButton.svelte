<script lang="ts">
  import { getContext } from "svelte";
  import { useConvexClient } from "convex-svelte";
  import {
    defaultBillingLabels,
    type BillingLabels,
  } from "../../core/i18n.js";
  import { getConvexErrorMessage } from "../../core/convexError.js";
  import {
    CREEM_CONVEX_CONTEXT_KEY,
    type CreemConvexContextValue,
  } from "../creemConvexContext.js";
  import type { CustomerPortalUrlFunction } from "../../core/connectedApi.js";

  interface Props {
    /** Override the provider's `customers.portalUrl` action. */
    portalUrl?: CustomerPortalUrlFunction;
    class?: string;
    labels?: BillingLabels;
    children?: import("svelte").Snippet;
  }

  let {
    portalUrl = undefined,
    class: className = "",
    labels = defaultBillingLabels,
    children,
  }: Props = $props();

  const provider = getContext<CreemConvexContextValue | undefined>(
    CREEM_CONVEX_CONTEXT_KEY,
  );
  const resolvedPortalUrl = $derived(
    portalUrl ?? provider?.api?.customers?.portalUrl,
  );

  const client = useConvexClient();
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  const handleClick = async () => {
    const action = resolvedPortalUrl;
    if (!action) return;
    isLoading = true;
    error = null;
    try {
      const result = await client.action(action, {});
      window.location.href = result.url;
    } catch (err) {
      error = getConvexErrorMessage(err, labels.portal.failedToOpen);
      isLoading = false;
    }
  };
</script>

{#if resolvedPortalUrl}
  <button
    type="button"
    class={`button-faded border border-error-border-subtle bg-error-surface-subtle text-error-foreground-default hover:bg-error-surface-tonal disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    disabled={isLoading}
    onclick={handleClick}
  >
    {#if isLoading}
      {labels.paymentRecovery.openingPortal}
    {:else if children}
      {@render children()}
    {:else}
      {labels.paymentRecovery.updatePaymentMethod}
    {/if}
  </button>
  {#if error}
    <p class="label-s mt-1 text-error-foreground-muted">{error}</p>
  {/if}
{/if}
