<script lang="ts">
  import { useConvexClient, useQuery } from "@mmailaender/convex-svelte";
  import CustomerPortalButton from "../primitives/CustomerPortalButton.svelte";
  import type { BillingPermissions, ConnectedBillingApi, ConnectedBillingModel } from "./types.js";
  import type { Snippet } from "svelte";

  interface Props {
    api: ConnectedBillingApi;
    permissions?: BillingPermissions;
    class?: string;
    children?: Snippet;
  }

  let { api, permissions = undefined, class: className = "", children }: Props = $props();

  const canAccess = $derived(permissions?.canAccessPortal !== false);

  const client = useConvexClient();

  // svelte-ignore state_referenced_locally
  const billingUiModelRef = api.uiModel;
  // svelte-ignore state_referenced_locally
  const portalUrlRef = api.customers?.portalUrl;

  const billingModelQuery = useQuery(billingUiModelRef, {});
  const model = $derived(billingModelQuery.data as ConnectedBillingModel | undefined);
  const hasCreemCustomer = $derived(model?.hasCreemCustomer ?? false);

  let isLoading = $state(false);

  const openPortal = async () => {
    if (!portalUrlRef) return;
    isLoading = true;
    try {
      const { url } = await client.action(portalUrlRef, {});
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      isLoading = false;
    }
  };
</script>

{#if portalUrlRef && hasCreemCustomer && canAccess}
  <CustomerPortalButton
    disabled={isLoading}
    onOpenPortal={openPortal}
    {className}
  >
    {#if children}
      {@render children()}
    {:else}
      Manage billing
    {/if}
  </CustomerPortalButton>
{/if}
