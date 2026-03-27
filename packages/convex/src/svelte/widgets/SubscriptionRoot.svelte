<script lang="ts">
  import { setContext, untrack } from "svelte";
  import { SvelteSet } from "svelte/reactivity";

  import { Dialog } from "@ark-ui/svelte/dialog";
  import { Portal } from "@ark-ui/svelte/portal";

  import PricingSection from "../primitives/PricingSection.svelte";
  import PaymentWarningBanner from "../primitives/PaymentWarningBanner.svelte";
  import ScheduledChangeBanner from "../primitives/ScheduledChangeBanner.svelte";

  import { useConvexClient, useQuery } from "@mmailaender/convex-svelte";
  import {
    SUBSCRIPTION_CONTEXT_KEY,
    type SubscriptionContextValue,
  } from "./subscriptionContext.js";
  import { pendingCheckout } from "../../core/pendingCheckout.js";

  import type { UIPlanEntry, RecurringCycle, UpdateBehavior } from "../../core/types.js";
  import { buildUpdateSummary } from "../../core/subscriptionUpdate.js";
  import { formatPriceWithInterval, formatSeatPrice } from "../primitives/shared.js";
  import type {
    BillingPermissions,
    CheckoutIntent,
    ConnectedBillingApi,
    ConnectedBillingModel,
    SubscriptionPlanRegistration,
  } from "./types.js";

  interface Props {
    api: ConnectedBillingApi;
    permissions?: BillingPermissions;
    class?: string;
    successUrl?: string;
    units?: number;
    showSeatPicker?: boolean;
    twoColumnLayout?: boolean;
    updateBehavior?: UpdateBehavior;
    onBeforeCheckout?: (intent: CheckoutIntent) => Promise<boolean> | boolean;
    children?: import("svelte").Snippet;
  }

  let {
    api,
    permissions = undefined,
    class: className = "",
    successUrl = undefined,
    units = undefined,
    showSeatPicker = false,
    twoColumnLayout = false,
    updateBehavior = "proration-charge-immediately",
    onBeforeCheckout = undefined,
    children,
  }: Props = $props();

  const canChange = $derived(permissions?.canChangeSubscription !== false);
  const canCancel = $derived(permissions?.canCancelSubscription !== false);
  const canResume = $derived(permissions?.canResumeSubscription !== false);

  const client = useConvexClient();

  // svelte-ignore state_referenced_locally
  const billingUiModelRef = api.uiModel;
  // svelte-ignore state_referenced_locally
  const checkoutLinkRef = api.checkouts.create;
  // svelte-ignore state_referenced_locally
  const updateRef = api.subscriptions?.update;
  // svelte-ignore state_referenced_locally
  const cancelRef = api.subscriptions?.cancel;
  // svelte-ignore state_referenced_locally
  const resumeRef = api.subscriptions?.resume;

  const billingModelQuery = useQuery(billingUiModelRef, {});

  let selectedCycle = $state<RecurringCycle>("every-month");
  let isActionLoading = $state(false);
  let actionError = $state<string | null>(null);
  let updateDialogOpen = $state(false);
  let pendingUpdate = $state<
    | { kind: "plan-switch"; plan: UIPlanEntry; productId: string; units?: number }
    | { kind: "seat-update"; units: number }
    | null
  >(null);
  let registeredPlans = $state<SubscriptionPlanRegistration[]>([]);
  let cancelDialogOpen = $state(false);

  const contextValue: SubscriptionContextValue = {
    registerPlan: (plan) => {
      registeredPlans = [
        ...registeredPlans.filter(
          (candidate) => candidate.planId !== plan.planId,
        ),
        plan,
      ];
      return () => {
        registeredPlans = registeredPlans.filter(
          (candidate) => candidate.planId !== plan.planId,
        );
      };
    },
  };

  setContext(SUBSCRIPTION_CONTEXT_KEY, contextValue);

  const model = $derived(
    (billingModelQuery.data ?? null) as ConnectedBillingModel | null,
  );
  const canCheckout = $derived(
    !model?.user && onBeforeCheckout != null
      ? true
      : permissions?.canCheckout !== false,
  );
  const canUpdateSeats = $derived(
    !model?.user && onBeforeCheckout != null
      ? true
      : permissions?.canUpdateSeats !== false,
  );
  const snapshot = $derived(model?.billingSnapshot ?? null);

  $effect(() => {
    if (!model?.user) return;
    untrack(() => {
      const pending = pendingCheckout.load();
      if (!pending) return;
      if ((model!.activeSubscriptions ?? []).length > 0) {
        pendingCheckout.clear();
        return;
      }
      startCheckout(pending.productId, pending.units);
    });
  });

  const activePlanId = $derived.by<string | null>(() => {
    if (!model) return null;
    // Use this component's matched subscription product ID, not the global one
    const subProductId = localSubscriptionProductId;
    if (subProductId) {
      const matchedPlan = registeredPlans.find((plan) => {
        const values = Object.values(plan.productIds ?? {}).filter(
          Boolean,
        ) as string[];
        return values.includes(subProductId);
      });
      return matchedPlan?.planId ?? null;
    }
    // No active subscription — if user is signed in, treat the free plan as active
    if (model.user) {
      const freePlan = plans.find((p) => p.category === "free");
      if (freePlan) return freePlan.planId;
    }
    return null;
  });

  const allProducts = $derived(model?.allProducts ?? []);

  const plansFromRegistered = $derived.by<UIPlanEntry[]>(() => {
    return registeredPlans.map((plan) => {
      const productIds = plan.productIds ?? {};
      const firstProductId = Object.values(productIds)[0];
      const firstProduct = firstProductId
        ? allProducts.find((p) => p.id === firstProductId)
        : undefined;

      const cycleKeys = Object.keys(productIds).filter(
        (k): k is RecurringCycle => k !== "custom",
      );

      const entry: UIPlanEntry = {
        planId: plan.planId,
        category:
          plan.type === "free"
            ? "free"
            : plan.type === "enterprise"
              ? "enterprise"
              : "paid",
        billingType:
          plan.type === "free" || plan.type === "enterprise"
            ? "custom"
            : "recurring",
        pricingModel: plan.type === "seat-based" ? "seat" : "flat",
        title:
          plan.title ??
          firstProduct?.name ??
          plan.planId.charAt(0).toUpperCase() + plan.planId.slice(1),
        description: plan.description ?? firstProduct?.description ?? undefined,
        contactUrl: plan.contactUrl,
        recommended: plan.recommended,
        creemProductIds:
          Object.keys(productIds).length > 0
            ? (productIds as Record<string, string>)
            : undefined,
      };
      if (cycleKeys.length > 0) {
        entry.billingCycles = cycleKeys;
      }
      return entry;
    });
  });

  const plans = $derived(plansFromRegistered);

  // Collect all product IDs that belong to plans in THIS component instance.
  const ownProductIds = $derived.by<Set<string>>(() => {
    const ids = new SvelteSet<string>();
    for (const plan of plans) {
      if (plan.creemProductIds) {
        for (const pid of Object.values(plan.creemProductIds)) {
          if (pid) ids.add(pid);
        }
      }
    }
    return ids;
  });

  // Find the subscription from activeSubscriptions that belongs to THIS component.
  const matchedSubscription = $derived.by(() => {
    const subs = model?.activeSubscriptions;
    if (!subs || ownProductIds.size === 0) return null;
    return subs.find((s) => ownProductIds.has(s.productId)) ?? null;
  });

  const ownsActiveSubscription = $derived(matchedSubscription != null);
  const localSubscriptionProductId = $derived(
    matchedSubscription?.productId ?? null,
  );
  const localCancelAtPeriodEnd = $derived(
    matchedSubscription?.cancelAtPeriodEnd ?? false,
  );
  const localCurrentPeriodEnd = $derived(
    matchedSubscription?.currentPeriodEnd ?? null,
  );
  const localSubscriptionState = $derived(matchedSubscription?.status ?? null);
  const localSubscribedSeats = $derived(matchedSubscription?.seats ?? null);

  const getFallbackSuccessUrl = (): string | undefined => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}${window.location.pathname}`;
  };

  const getPreferredTheme = (): "light" | "dark" => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const startCheckout = async (productId: string, checkoutUnits?: number) => {
    if (onBeforeCheckout) {
      const proceed = await onBeforeCheckout({
        productId,
        units: checkoutUnits,
      });
      if (!proceed) return;
    }
    isActionLoading = true;
    actionError = null;
    try {
      const { url } = await client.action(checkoutLinkRef, {
        productId,
        ...(successUrl ? { successUrl } : {}),
        fallbackSuccessUrl: getFallbackSuccessUrl(),
        theme: getPreferredTheme(),
        ...(checkoutUnits != null ? { units: checkoutUnits } : {}),
      });
      // Suppress Convex client's beforeunload dialog during checkout redirect.
      // Convex registers via addEventListener, so onbeforeunload=null has no effect.
      // A capture-phase listener fires before non-capture listeners on the same target
      // in modern browsers, and stopImmediatePropagation() blocks all subsequent handlers.
      window.addEventListener(
        "beforeunload",
        (e) => {
          e.stopImmediatePropagation();
        },
        { capture: true, once: true },
      );
      window.location.href = url;
      window.location.href = url;
    } catch (error) {
      actionError = error instanceof Error ? error.message : "Checkout failed";
    } finally {
      isActionLoading = false;
    }
  };

  const handlePricingCheckout = async (payload: {
    plan: UIPlanEntry;
    productId: string;
    units?: number;
  }) => {
    await startCheckout(payload.productId, payload.units);
  };

  const requestSwitchPlan = (payload: {
    plan: UIPlanEntry;
    productId: string;
    units?: number;
  }) => {
    pendingUpdate = { kind: "plan-switch", ...payload };
    updateDialogOpen = true;
  };

  const confirmUpdate = async () => {
    if (!updateRef || !pendingUpdate) return;
    const update = pendingUpdate;
    const subId = matchedSubscription?.id;
    updateDialogOpen = false;
    pendingUpdate = null;
    actionError = null;
    try {
      if (update.kind === "plan-switch") {
        await client.mutation(
          updateRef,
          {
            productId: update.productId,
            ...(subId ? { subscriptionId: subId } : {}),
            updateBehavior,
          },
          {
            optimisticUpdate: (store) => {
              const current = store.getQuery(billingUiModelRef, {});
              if (current) {
                const m = current as ConnectedBillingModel;
                store.setQuery(
                  billingUiModelRef,
                  {},
                  {
                    ...m,
                    activeSubscriptions: (m.activeSubscriptions ?? []).map((s) =>
                      ownProductIds.has(s.productId)
                        ? { ...s, productId: update.productId }
                        : s,
                    ),
                  },
                );
              }
            },
          },
        );
      } else {
        await client.mutation(
          updateRef,
          {
            units: update.units,
            ...(subId ? { subscriptionId: subId } : {}),
            updateBehavior,
          },
          {
            optimisticUpdate: (store) => {
              const current = store.getQuery(billingUiModelRef, {});
              if (current) {
                const m = current as ConnectedBillingModel;
                store.setQuery(
                  billingUiModelRef,
                  {},
                  {
                    ...m,
                    activeSubscriptions: (m.activeSubscriptions ?? []).map((s) =>
                      s.id === subId ? { ...s, seats: update.units } : s,
                    ),
                  },
                );
              }
            },
          },
        );
      }
    } catch (error) {
      actionError = error instanceof Error
        ? error.message
        : update.kind === "plan-switch"
          ? "Switch failed"
          : "Seat update failed";
    }
  };

  const handleUpdateSeats = (payload: { units: number }) => {
    pendingUpdate = { kind: "seat-update", units: payload.units };
    updateDialogOpen = true;
  };

  const updateSummary = $derived.by(() => {
    if (!pendingUpdate) return null;

    if (pendingUpdate.kind === "plan-switch") {
      const currentPlan = plans.find((p) => {
        const pids = p.creemProductIds ? Object.values(p.creemProductIds) : [];
        return localSubscriptionProductId != null && pids.includes(localSubscriptionProductId);
      });
      const currentTitle = currentPlan?.title ?? "Current plan";
      const currentPrice = formatPriceWithInterval(localSubscriptionProductId ?? undefined, allProducts);
      const newPrice = formatPriceWithInterval(pendingUpdate.productId, allProducts);

      return buildUpdateSummary({
        kind: "plan-switch",
        updateBehavior,
        currentLabel: currentPrice ? `${currentTitle} \u00b7 ${currentPrice}` : currentTitle,
        newLabel: newPrice
          ? `${pendingUpdate.plan.title ?? "New plan"} \u00b7 ${newPrice}`
          : (pendingUpdate.plan.title ?? "New plan"),
        currentPeriodEnd: matchedSubscription?.currentPeriodEnd,
        isTrialing: matchedSubscription?.status === "trialing",
        trialEnd: matchedSubscription?.trialEnd,
      });
    }

    const currentSeats = localSubscribedSeats ?? 1;
    const currentPrice = formatSeatPrice(localSubscriptionProductId ?? undefined, allProducts, currentSeats);
    const newPrice = formatSeatPrice(localSubscriptionProductId ?? undefined, allProducts, pendingUpdate.units);

    return buildUpdateSummary({
      kind: "seat-update",
      updateBehavior,
      currentLabel: currentPrice ?? `${currentSeats} seat${currentSeats !== 1 ? "s" : ""}`,
      newLabel: newPrice ?? `${pendingUpdate.units} seat${pendingUpdate.units !== 1 ? "s" : ""}`,
      currentPeriodEnd: matchedSubscription?.currentPeriodEnd,
      isTrialing: matchedSubscription?.status === "trialing",
      trialEnd: matchedSubscription?.trialEnd,
    });
  });

  const confirmCancelSubscription = async () => {
    if (!cancelRef) return;
    const subId = matchedSubscription?.id;
    cancelDialogOpen = false;
    actionError = null;
    try {
      await client.mutation(
        cancelRef,
        {
          ...(subId ? { subscriptionId: subId } : {}),
        },
        {
          optimisticUpdate: (store) => {
            const current = store.getQuery(billingUiModelRef, {});
            if (current) {
              const m = current as ConnectedBillingModel;
              store.setQuery(
                billingUiModelRef,
                {},
                {
                  ...m,
                  activeSubscriptions: (m.activeSubscriptions ?? []).map((s) =>
                    ownProductIds.has(s.productId)
                      ? { ...s, cancelAtPeriodEnd: true }
                      : s,
                  ),
                },
              );
            }
          },
        },
      );
    } catch (error) {
      actionError = error instanceof Error ? error.message : "Cancel failed";
    }
  };

  const resumeSubscription = async () => {
    if (!resumeRef) return;
    const subId = matchedSubscription?.id;
    actionError = null;
    try {
      await client.mutation(
        resumeRef,
        {
          ...(subId ? { subscriptionId: subId } : {}),
        },
        {
          optimisticUpdate: (store) => {
            const current = store.getQuery(billingUiModelRef, {});
            if (current) {
              const m = current as ConnectedBillingModel;
              store.setQuery(
                billingUiModelRef,
                {},
                {
                  ...m,
                  activeSubscriptions: (m.activeSubscriptions ?? []).map((s) =>
                    ownProductIds.has(s.productId)
                      ? { ...s, cancelAtPeriodEnd: false, status: "active" }
                      : s,
                  ),
                },
              );
            }
          },
        },
      );
    } catch (error) {
      actionError = error instanceof Error ? error.message : "Resume failed";
    }
  };

  const openCancelDialog = () => {
    cancelDialogOpen = true;
  };
</script>

<div class="hidden" aria-hidden="true">
  {@render children?.()}
</div>

<section class={`space-y-4 ${className}`}>
  {#if actionError}
    <div
      class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {actionError}
    </div>
  {/if}

  {#if !model}
    <p class="text-sm text-zinc-500">Loading billing model…</p>
  {:else}
    {#if ownsActiveSubscription && snapshot}
      <ScheduledChangeBanner
        snapshot={{
          ...snapshot,
          metadata: {
            ...snapshot.metadata,
            cancelAtPeriodEnd: localCancelAtPeriodEnd,
            currentPeriodEnd: localCurrentPeriodEnd,
          },
        }}
        isLoading={isActionLoading}
        onResume={resumeRef && canResume ? resumeSubscription : undefined}
      />
    {/if}
    <PaymentWarningBanner {snapshot} />

    <PricingSection
      {plans}
      snapshot={snapshot ? { ...snapshot, activePlanId } : null}
      {selectedCycle}
      products={allProducts}
      subscriptionProductId={localSubscriptionProductId}
      subscriptionStatus={localSubscriptionState}
      subscriptionTrialEnd={matchedSubscription?.trialEnd ?? null}
      {units}
      {showSeatPicker}
      {twoColumnLayout}
      subscribedSeats={localSubscribedSeats}
      isGroupSubscribed={ownsActiveSubscription}
      onCycleChange={(cycle) => {
        selectedCycle = cycle;
      }}
      disableCheckout={!canCheckout}
      disableSwitch={!canChange}
      disableSeats={!canUpdateSeats}
      onCheckout={canCheckout ? handlePricingCheckout : undefined}
      onSwitchPlan={updateRef && canChange ? requestSwitchPlan : undefined}
      onUpdateSeats={updateRef && canUpdateSeats
        ? handleUpdateSeats
        : undefined}
      onCancelSubscription={cancelRef &&
      canCancel &&
      ownsActiveSubscription &&
      !localCancelAtPeriodEnd
        ? openCancelDialog
        : undefined}
    />

    <div class="flex flex-wrap items-center gap-3">
      {#if children}
        {@render children()}
      {/if}
    </div>

    <Dialog.Root
      open={cancelDialogOpen}
      onOpenChange={(details: { open: boolean }) => {
        cancelDialogOpen = details.open;
      }}
    >
      <Portal>
        <Dialog.Backdrop class="dialog-backdrop" />
        <Dialog.Positioner class="dialog-positioner">
          <Dialog.Content class="dialog-content">
            <Dialog.CloseTrigger
              class="icon-button-ghost-sm absolute right-2 top-2"
              aria-label="Close dialog"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                class="h-4 w-4"
              >
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </Dialog.CloseTrigger>
            <Dialog.Title class="dialog-title">
              Cancel subscription?
            </Dialog.Title>
            <Dialog.Description class="dialog-description">
              Are you sure you want to cancel your subscription? You will
              continue to have access until the end of your current billing
              period.
            </Dialog.Description>
            <div class="dialog-actions">
              <button
                type="button"
                class="dialog-action-danger"
                onclick={() => confirmCancelSubscription()}
              >
                Yes, cancel
              </button>
              <Dialog.CloseTrigger class="button-faded h-8 w-full">
                Keep subscription
              </Dialog.CloseTrigger>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>

    <Dialog.Root
      open={updateDialogOpen}
      onOpenChange={(details: { open: boolean }) => {
        updateDialogOpen = details.open;
        if (!details.open) pendingUpdate = null;
      }}
    >
      <Portal>
        <Dialog.Backdrop class="dialog-backdrop" />
        <Dialog.Positioner class="dialog-positioner">
          <Dialog.Content class="dialog-content">
            <Dialog.CloseTrigger
              class="icon-button-ghost-sm absolute right-2 top-2"
              aria-label="Close dialog"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                class="h-4 w-4"
              >
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </Dialog.CloseTrigger>
            <Dialog.Title class="dialog-title">
              {updateSummary?.title}
            </Dialog.Title>
            {#if updateSummary}
              <div class="my-3 flex flex-col gap-1 rounded-lg bg-surface-subtle px-3 py-2.5">
                <span class="label-m text-foreground-muted">
                  {updateSummary.currentLabel}
                </span>
                <span class="body-s text-foreground-placeholder">→</span>
                <span class="label-m text-foreground-default">
                  {updateSummary.newLabel}
                </span>
              </div>
              <Dialog.Description class="dialog-description">
                {updateSummary.description}
                {#if updateSummary.dateNote}
                  {` ${updateSummary.dateNote}`}
                {/if}
              </Dialog.Description>
            {/if}
            <div class="dialog-actions">
              <button
                type="button"
                class="button-filled h-8 w-full"
                onclick={() => confirmUpdate()}
              >
                {updateSummary?.confirmLabel ?? "Confirm"}
              </button>
              <Dialog.CloseTrigger class="button-faded h-8 w-full">
                Cancel
              </Dialog.CloseTrigger>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  {/if}
</section>
