<!--
  @component
  Button that opens the Creem customer billing portal.

  Renders nothing when the billing entity has no Creem customer record yet
  (customers are created on first checkout) or when `canAccessPortal` is false.
-->
<script lang="ts">
  import { getContext } from "svelte";
  import { useConvexClient, useQuery } from "convex-svelte";
  import CustomerPortalButton from "../primitives/CustomerPortalButton.svelte";
  import type { BillingPermissions, ConnectedBillingModel } from "./types.js";
  import type { Snippet } from "svelte";
  import {
    CREEM_CONVEX_CONTEXT_KEY,
    type CreemConvexContextValue,
  } from "../creemConvexContext.js";
  import { resolveBillingI18n } from "../../core/i18n.js";
  import { getConvexErrorMessage } from "../../core/convexError.js";

  interface Props {
    /** Local UI permission overrides. `canAccessPortal: false` hides the portal button. */
    permissions?: BillingPermissions;
    /** Button CSS class. */
    class?: string;
    /** Optional custom button label. */
    children?: Snippet;
  }

  let { permissions = undefined, class: className = "", children }: Props = $props();

  const provider = getContext<CreemConvexContextValue | undefined>(
    CREEM_CONVEX_CONTEXT_KEY,
  );
  const resolvedApi = provider?.api;
  if (!resolvedApi) {
    throw new Error(
      "BillingPortal must be rendered inside <CreemConvexProvider>.",
    );
  }
  const resolvedPermissions = $derived(permissions ?? provider?.permissions);
  const i18n = $derived(resolveBillingI18n(provider?.i18n));

  const canAccess = $derived(resolvedPermissions?.canAccessPortal !== false);

  const client = useConvexClient();

  const billingUiModelRef = resolvedApi.uiModel;
  const portalUrlRef = resolvedApi.customers?.portalUrl;

  const billingModelQuery = useQuery(billingUiModelRef, {});
  const model = $derived(billingModelQuery.data as ConnectedBillingModel | undefined);
  const hasCreemCustomer = $derived(model?.hasCreemCustomer ?? false);

  let isLoading = $state(false);
  let error = $state<string | null>(null);

  const openPortal = async () => {
    if (!portalUrlRef) return;
    isLoading = true;
    error = null;
    try {
      const { url } = await client.action(portalUrlRef, {});
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      // Without this the rejection is unhandled and the user gets no feedback
      // at all — the button just stops spinning.
      error = getConvexErrorMessage(cause, i18n.labels.portal.failedToOpen);
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
    labels={i18n.labels}
  >
    {#if children}
      {@render children()}
    {:else}
      {i18n.labels.portal.manageBilling}
    {/if}
  </CustomerPortalButton>
  {#if error}
    <p role="alert" class="text-error-foreground-default text-sm">{error}</p>
  {/if}
{/if}
