<!--
  @component
  Shows and changes the email address Creem sends invoices and receipts to.
  The Creem customer portal does not offer this.

  Renders a `<form>` that owns the state and provides it to the
  `BillingEmail.*` parts. Without children it renders the default layout.

  Renders nothing when the billing entity has no Creem customer record yet
  (customers are created on first checkout), when `canManageBillingEmail` is
  false, or when `customers.billingEmail` and `customers.updateBillingEmail`
  are not both wired.
-->
<script lang="ts">
  import { getContext, setContext, untrack, type Snippet } from "svelte";
  import type { HTMLFormAttributes } from "svelte/elements";
  import { useConvexClient, useQuery } from "convex-svelte";
  import type { BillingPermissions, ConnectedBillingModel } from "./types.js";
  import {
    CREEM_CONVEX_CONTEXT_KEY,
    type CreemConvexContextValue,
  } from "../creemConvexContext.js";
  import { resolveBillingI18n } from "../../core/i18n.js";
  import {
    billingEmailElementIds,
    createBillingEmailController,
    deriveBillingEmailView,
    type BillingEmailPart,
  } from "../../core/billingEmail.js";
  import {
    BILLING_EMAIL_CONTEXT_KEY,
    type BillingEmailContextValue,
  } from "./billingEmailContext.js";
  import BillingEmailTitle from "./BillingEmailTitle.svelte";
  import BillingEmailDescription from "./BillingEmailDescription.svelte";
  import BillingEmailInput from "./BillingEmailInput.svelte";
  import BillingEmailSave from "./BillingEmailSave.svelte";
  import BillingEmailStatus from "./BillingEmailStatus.svelte";
  import BillingEmailError from "./BillingEmailError.svelte";
  import BillingEmailRetry from "./BillingEmailRetry.svelte";

  interface Props
    extends Omit<HTMLFormAttributes, "class" | "children" | "onsubmit"> {
    /** Local UI permission overrides. `canManageBillingEmail: false` hides the form. */
    permissions?: BillingPermissions;
    /** Drop the default classes of the root and every part. */
    unstyled?: boolean;
    /** CSS class added to the form's defaults. */
    class?: string;
    /** Custom layout built from `BillingEmail.*` parts. Receives the context. */
    children?: Snippet<[BillingEmailContextValue]>;
  }

  let {
    permissions = undefined,
    unstyled = false,
    class: className = "",
    children,
    ...rest
  }: Props = $props();

  const baseId = $props.id();
  const ids = billingEmailElementIds(baseId);

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

  let formState = $state.raw(controller.getState());

  // Subscribe before the entity effect below so the loading state is seen.
  $effect(() =>
    controller.subscribe(() => {
      formState = controller.getState();
    }),
  );

  $effect(() => {
    controller.setEntity(entityKey);
  });

  const view = $derived(deriveBillingEmailView(formState, labels));

  // Counted rather than flagged so that a part rendered twice stays
  // registered until both copies unmount.
  const partCounts = $state<Record<BillingEmailPart, number>>({
    title: 0,
    description: 0,
    label: 0,
    error: 0,
  });
  const parts = $derived({
    title: partCounts.title > 0,
    description: partCounts.description > 0,
    label: partCounts.label > 0,
    error: partCounts.error > 0,
  });

  const context: BillingEmailContextValue = {
    get state() {
      return formState;
    },
    get isLoading() {
      return view.isLoading;
    },
    get canSave() {
      return view.canSave;
    },
    get isInvalid() {
      return view.isInvalid;
    },
    get errorMessage() {
      return view.errorMessage;
    },
    get labels() {
      return labels;
    },
    get unstyled() {
      return unstyled;
    },
    ids,
    get parts() {
      return parts;
    },
    setDraft: (draft) => controller.setDraft(draft),
    markTouched: () => controller.markTouched(),
    submit: () => void controller.submit(),
    reload: () => controller.reload(),
    // Parts call this from an effect. Untracked, so the count the part bumps
    // is not a dependency that would re-run that effect forever.
    registerPart: (part) => {
      untrack(() => {
        partCounts[part] += 1;
      });
      return () => {
        untrack(() => {
          partCounts[part] -= 1;
        });
      };
    },
  };

  setContext(BILLING_EMAIL_CONTEXT_KEY, context);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    context.submit();
  };
</script>

{#if entityKey !== null && formState.status !== "no-customer"}
  <form
    {...rest}
    novalidate
    aria-labelledby={parts.title ? ids.title : undefined}
    class={unstyled
      ? className
      : `creem-base:w-full creem-base:max-w-md creem-base:space-y-3 creem-base:text-left ${className}`.trim()}
    onsubmit={submit}
  >
    {#if children}
      {@render children(context)}
    {:else}
      <div class={unstyled ? undefined : "space-y-1"}>
        <BillingEmailTitle />
        <BillingEmailDescription />
      </div>
      <div class={unstyled ? undefined : "flex flex-col gap-2 sm:flex-row"}>
        <BillingEmailInput class={unstyled ? "" : "sm:flex-1"} />
        <BillingEmailSave />
      </div>
      <BillingEmailStatus />
      <BillingEmailError />
      <BillingEmailRetry />
    {/if}
  </form>
{/if}
