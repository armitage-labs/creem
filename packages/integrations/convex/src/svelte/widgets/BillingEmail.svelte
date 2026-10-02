<!--
  @component
  Shows and changes the email address Creem sends invoices and receipts to.
  The Creem customer portal does not offer this.

  Renders nothing when the billing entity has no Creem customer record yet
  (customers are created on first checkout), when `canManageBillingEmail` is
  false, or when `customers.billingEmail` and `customers.updateBillingEmail`
  are not both wired.
-->
<script lang="ts">
  import { getContext } from "svelte";
  import { useConvexClient, useQuery } from "convex-svelte";
  import type { BillingPermissions, ConnectedBillingModel } from "./types.js";
  import {
    CREEM_CONVEX_CONTEXT_KEY,
    type CreemConvexContextValue,
  } from "../creemConvexContext.js";
  import { resolveBillingI18n } from "../../core/i18n.js";
  import { getConvexErrorMessage } from "../../core/convexError.js";
  import {
    canSaveBillingEmail,
    createBillingEmailController,
    isValidBillingEmail,
    normalizeBillingEmail,
  } from "../../core/billingEmail.js";

  interface Props {
    /** Local UI permission overrides. `canManageBillingEmail: false` hides the widget. */
    permissions?: BillingPermissions;
    /** Wrapper CSS class. */
    class?: string;
  }

  let { permissions = undefined, class: className = "" }: Props = $props();

  const provider = getContext<CreemConvexContextValue | undefined>(
    CREEM_CONVEX_CONTEXT_KEY,
  );
  const resolvedApi = provider?.api;
  if (!resolvedApi) {
    throw new Error(
      "BillingEmail must be rendered inside <CreemConvexProvider>.",
    );
  }
  const resolvedPermissions = $derived(permissions ?? provider?.permissions);
  const i18n = $derived(resolveBillingI18n(provider?.i18n));
  const labels = $derived(i18n.labels.billingEmail);

  const canManage = $derived(
    resolvedPermissions?.canManageBillingEmail !== false,
  );

  const client = useConvexClient();

  const billingEmailRef = resolvedApi.customers?.billingEmail;
  const updateBillingEmailRef = resolvedApi.customers?.updateBillingEmail;

  const billingModelQuery = useQuery(resolvedApi.uiModel, {});
  const model = $derived(
    billingModelQuery.data as ConnectedBillingModel | undefined,
  );

  // The snapshot carries the entity the resolver picked, so switching the
  // active organization changes this key and resets the form.
  const entityKey = $derived(
    billingEmailRef &&
      updateBillingEmailRef &&
      canManage &&
      model?.hasCreemCustomer
      ? (model.snapshot?.entityId ?? null)
      : null,
  );

  const controller = createBillingEmailController({
    load: async (expectedEntityId) =>
      billingEmailRef
        ? await client.action(billingEmailRef, { expectedEntityId })
        : { status: "no-customer" },
    save: async (expectedEntityId, email) =>
      updateBillingEmailRef
        ? await client.action(updateBillingEmailRef, {
            expectedEntityId,
            email,
          })
        : { status: "no-customer" },
  });

  let view = $state.raw(controller.getState());

  // Subscribe before the entity effect below so the loading state is seen.
  $effect(() =>
    controller.subscribe(() => {
      view = controller.getState();
    }),
  );

  $effect(() => {
    controller.setEntity(entityKey);
  });

  const isLoading = $derived(
    view.status === "idle" || view.status === "loading",
  );
  const canSave = $derived(canSaveBillingEmail(view));
  const isInvalid = $derived(
    view.status === "ready" &&
      normalizeBillingEmail(view.draft) !== "" &&
      !isValidBillingEmail(view.draft),
  );
  const errorMessage = $derived(
    view.error
      ? getConvexErrorMessage(
          view.error.cause,
          view.error.phase === "load" ? labels.loadFailed : labels.saveFailed,
        )
      : null,
  );

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    void controller.submit();
  };
</script>

{#if entityKey !== null && view.status !== "no-customer"}
  <section class={`w-full max-w-md space-y-3 text-left ${className}`}>
    <div class="space-y-1">
      <h3 class="title-s text-foreground-default">{labels.title}</h3>
      <p class="body-m text-foreground-muted">{labels.description}</p>
    </div>
    <form class="flex flex-col gap-2 sm:flex-row" onsubmit={submit}>
      <input
        type="email"
        name="billingEmail"
        autocomplete="email"
        class="input-default w-full sm:flex-1"
        aria-label={labels.inputLabel}
        aria-invalid={isInvalid}
        placeholder={labels.placeholder}
        value={view.draft}
        disabled={view.status !== "ready" || view.saving}
        oninput={(event) => controller.setDraft(event.currentTarget.value)}
      />
      <button
        type="submit"
        class="button-filled cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!canSave}
      >
        {view.saving ? labels.saving : labels.save}
      </button>
    </form>
    {#if isLoading}
      <p role="status" class="body-s text-foreground-placeholder">
        {labels.loading}
      </p>
    {:else if view.saved}
      <p role="status" class="body-s text-success-foreground-default">
        {labels.saved}
      </p>
    {/if}
    {#if errorMessage}
      <p role="alert" class="text-error-foreground-default text-sm">
        {errorMessage}
      </p>
    {/if}
    {#if view.status === "load-error"}
      <button
        type="button"
        class="button-outline cursor-pointer"
        onclick={controller.reload}
      >
        {labels.retry}
      </button>
    {/if}
  </section>
{/if}
