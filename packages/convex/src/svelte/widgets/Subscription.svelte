<script lang="ts">
  import { getContext, setContext, untrack } from "svelte";
  import type { RecurringCycle } from "../../core/types.js";
  import {
    SUBSCRIPTION_CONTEXT_KEY,
    type SubscriptionContextValue,
  } from "./subscriptionContext.js";
  import {
    SUBSCRIPTION_ITEM_CONTEXT_KEY,
    type SubscriptionItemContextValue,
  } from "./subscriptionItemContext.js";
  import PricingCard from "../primitives/PricingCard.svelte";
  import {
    formatPriceWithInterval,
    formatUnitPriceBreakdown,
    resolveProductIdForPlan,
  } from "../../core/display.js";
  import type { UIPlanEntry } from "../../core/types.js";
  import { defaultBillingLabels } from "../../core/i18n.js";
  import { resolvePlanTarget } from "../../core/planTarget.js";

  type BaseProps = {
    /** Unique plan ID. Defaults to first product ID or the plan type when omitted. */
    planId?: string;
    /** Display title. Defaults to catalog entry or synced Creem product name. */
    title?: string;
    /** Display description. Defaults to catalog entry or synced Creem product description. */
    description?: string;
    /** Optional pricing group ID used by group selectors. */
    groupId?: string;
    /** Optional display label for `groupId`. */
    groupTitle?: string;
    /** Whether this plan should render as recommended. */
    recommended?: boolean;
    /** Wrapper CSS class for custom item children, or card class for default rendering. */
    class?: string;
    /** Optional custom plan-card markup. */
    children?: import("svelte").Snippet;
  };

  type Props =
    | (BaseProps & { type?: undefined; productIds?: undefined; contactUrl?: string })
    | (BaseProps & { type: "free"; productIds?: undefined; contactUrl?: string })
    | (BaseProps & { type: "single"; productIds?: Partial<Record<RecurringCycle, string>>; contactUrl?: string })
    | (BaseProps & { type: "unit-based"; productIds?: Partial<Record<RecurringCycle, string>>; contactUrl?: string })
    | (BaseProps & { type: "enterprise"; productIds?: undefined; contactUrl: string });

  let {
    planId = undefined,
    type = undefined,
    title = undefined,
    description = undefined,
    groupId = undefined,
    groupTitle = undefined,
    contactUrl = undefined,
    recommended = undefined,
    productIds = undefined,
    class: className = "",
    children,
  }: Props = $props();

  // Must be used inside a <Subscription.Root>
  const rootContext = getContext<SubscriptionContextValue | undefined>(
    SUBSCRIPTION_CONTEXT_KEY,
  );
  const fallbackPlan = {
    planId: "__pending__",
    category: "paid",
    billingType: "recurring",
    title: "",
  } as UIPlanEntry;
  const resolvedPlanId = $derived(
    planId ?? Object.values(productIds ?? {})[0] ?? type,
  );

  if (rootContext) {
    $effect(() => {
      if (!resolvedPlanId) return;
      const registration = {
        planId: resolvedPlanId,
        type,
        title,
        description,
        groupId,
        groupTitle,
        contactUrl,
        recommended,
        productIds,
      };
      const unregister = untrack(() => rootContext.registerPlan(registration));
      return () => untrack(unregister);
    });
  }

  const plan = $derived(
    resolvedPlanId && rootContext ? rootContext.getPlan(resolvedPlanId) : undefined,
  );
  const visible = $derived(
    resolvedPlanId && rootContext ? rootContext.isPlanVisible(resolvedPlanId) : false,
  );
  const selectedCycle = $derived(rootContext?.getSelectedCycle());
  const productId = $derived(plan ? resolveProductIdForPlan(plan, selectedCycle) : undefined);
  const planTarget = $derived(plan ? resolvePlanTarget(plan, productId) : null);
  const isActiveProduct = $derived(
    rootContext?.getSubscriptionProductId() != null &&
      productId != null &&
      productId === rootContext?.getSubscriptionProductId(),
  );
  const isActivePlanOtherCycle = $derived(
    !isActiveProduct &&
      rootContext?.getActivePlanId() === plan?.planId &&
      productId != null,
  );
  const isActiveAppPlan = $derived(
      !isActiveProduct &&
      planTarget?.kind === "app-plan" &&
      rootContext?.getActivePlanId() === plan?.planId,
  );
  const isSiblingPlan = $derived(
    !isActiveProduct &&
      !isActivePlanOtherCycle &&
      rootContext?.getIsGroupSubscribed() === true &&
      planTarget?.kind === "creem-product",
  );
  const isScheduledTarget = $derived.by(() => {
    const scheduledUpdate = rootContext?.getScheduledUpdate();
    return scheduledUpdate?.status === "pending" &&
      ((scheduledUpdate.targetProductId != null &&
        productId != null &&
        scheduledUpdate.targetProductId === productId) ||
        (scheduledUpdate.targetPlanId != null &&
          scheduledUpdate.targetPlanId === plan?.planId));
  });
  let checkoutUnits = $derived(rootContext?.getUnits() ?? 1);

  const effectiveUnits = $derived(
    plan?.pricingModel === "unit"
      ? children
        ? checkoutUnits
        : rootContext?.getShowUnitPicker()
          ? (rootContext?.getUnits() ?? 1)
          : rootContext?.getUnits()
      : undefined,
  );
  const price = $derived.by(() => {
    if (!plan) return null;
    if (plan.category === "free") {
      return rootContext?.getLabels().subscription.free ?? defaultBillingLabels.subscription.free;
    }
    if (plan.category === "trial") {
      return rootContext?.getLabels().subscription.freeTrial ?? defaultBillingLabels.subscription.freeTrial;
    }
    if (planTarget?.kind === "app-plan" || plan.category === "enterprise") {
      return rootContext?.getLabels().subscription.custom ?? defaultBillingLabels.subscription.custom;
    }
    if (
      plan.pricingModel === "unit" &&
      (isActiveProduct || isSiblingPlan || isActivePlanOtherCycle)
    ) {
      return formatUnitPriceBreakdown(
        productId,
        rootContext?.getProducts() ?? [],
        rootContext?.getSubscribedUnits() ?? checkoutUnits,
        rootContext?.getLabels() ?? defaultBillingLabels,
        rootContext?.formatCurrency,
      )?.total ?? formatPriceWithInterval(
        productId,
        rootContext?.getProducts() ?? [],
        rootContext?.getLabels() ?? defaultBillingLabels,
        rootContext?.formatCurrency,
      );
    }
    return formatPriceWithInterval(
      productId,
      rootContext?.getProducts() ?? [],
      rootContext?.getLabels() ?? defaultBillingLabels,
      rootContext?.formatCurrency,
    );
  });
  const priceCaption = $derived.by(() => {
    if (
      !plan ||
      plan.pricingModel !== "unit" ||
      !(isActiveProduct || isSiblingPlan || isActivePlanOtherCycle)
    ) {
      return null;
    }
    return (
      formatUnitPriceBreakdown(
        productId,
        rootContext?.getProducts() ?? [],
        rootContext?.getSubscribedUnits() ?? checkoutUnits,
        rootContext?.getLabels() ?? defaultBillingLabels,
        rootContext?.formatCurrency,
      )?.calculation ?? null
    );
  });
  const onCheckout = $derived.by(() => {
    if (!rootContext || !plan || !productId || isActiveProduct || isActiveAppPlan || isSiblingPlan || isActivePlanOtherCycle || isScheduledTarget) {
      return undefined;
    }
    return () => rootContext.checkout({ plan, productId, units: effectiveUnits });
  });
  const onSwitch = $derived.by(() => {
    if (!rootContext || !plan) {
      return undefined;
    }
    if (isScheduledTarget) {
      return undefined;
    }
    if (
      planTarget?.kind === "app-plan" &&
      !isActiveAppPlan &&
      !rootContext.getIsGroupSubscribed()
    ) {
      return () =>
        rootContext.switchPlan?.({
          plan,
          appPlanId: planTarget.appPlanId,
        });
    }
    if (!productId || !(isSiblingPlan || isActivePlanOtherCycle)) {
      return undefined;
    }
    return () =>
      rootContext.switchPlan?.({
        plan,
        productId,
        units: plan.pricingModel === "unit"
          ? (rootContext.getSubscribedUnits() ?? effectiveUnits)
          : effectiveUnits,
      });
  });

  const itemContext: SubscriptionItemContextValue = {
    get plan() {
      return plan ?? fallbackPlan;
    },
    get isActive() {
      return isActiveProduct || isActiveAppPlan;
    },
    get isSwitchPlan() {
      return isSiblingPlan || isActivePlanOtherCycle;
    },
    get isScheduledTarget() {
      return isScheduledTarget;
    },
    get scheduledEffectiveDate() {
      return rootContext?.getScheduledEffectiveDate() ?? null;
    },
    get isRecommended() {
      return plan?.recommended === true;
    },
    get selectedCycle() {
      return selectedCycle ?? "every-month";
    },
    get currentProductId() {
      return productId;
    },
    get price() {
      return price;
    },
    get priceCaption() {
      return priceCaption;
    },
    get checkoutUnits() {
      return checkoutUnits;
    },
    get subscribedUnits() {
      return rootContext?.getSubscribedUnits() ?? null;
    },
    get disableUnits() {
      return rootContext?.getDisableUnits() ?? false;
    },
    get unstyled() {
      return rootContext?.getUnstyled() ?? false;
    },
    get labels() {
      return rootContext?.getLabels() ?? defaultBillingLabels;
    },
    setCheckoutUnits(units) {
      if (units > 0) checkoutUnits = units;
    },
    get onCheckout() {
      return onCheckout;
    },
    get onSwitch() {
      return onSwitch;
    },
    get onUpdateUnits() {
      return rootContext?.updateUnits
        ? (units: number) => rootContext.updateUnits?.({ units })
        : undefined;
    },
    get onCancelSubscription() {
      return isActiveProduct || isActiveAppPlan
        ? rootContext?.cancelSubscription
        : undefined;
    },
  };

  setContext(SUBSCRIPTION_ITEM_CONTEXT_KEY, itemContext);
</script>

{#if rootContext && plan && visible}
  {#if children}
    <section class={className}>
      {@render children()}
    </section>
  {:else}
    <PricingCard
      {plan}
      {selectedCycle}
      activePlanId={rootContext.getActivePlanId()}
      subscriptionProductId={rootContext.getSubscriptionProductId()}
      subscriptionStatus={rootContext.getSubscriptionStatus()}
      subscriptionTrialEnd={rootContext.getSubscriptionTrialEnd()}
      scheduledUpdate={rootContext.getScheduledUpdate()}
      scheduledEffectiveDate={rootContext.getScheduledEffectiveDate()}
      products={rootContext.getProducts()}
      units={rootContext.getUnits()}
      showUnitPicker={rootContext.getShowUnitPicker()}
      reserveTrialCaption={rootContext.getReserveTrialCaption()}
      subscribedUnits={rootContext.getSubscribedUnits()}
      isGroupSubscribed={rootContext.getIsGroupSubscribed()}
      disableCheckout={rootContext.getDisableCheckout()}
      disableSwitch={rootContext.getDisableSwitch()}
      disableUnits={rootContext.getDisableUnits()}
      className={className}
      onCheckout={(payload) => rootContext.checkout(payload)}
      onSwitchPlan={rootContext.switchPlan}
      onUpdateUnits={rootContext.updateUnits}
      onCancelSubscription={rootContext.cancelSubscription}
      labels={rootContext.getLabels()}
      formatCurrency={rootContext.formatCurrency}
    />
  {/if}
{/if}
