<!--
  @component
  A single plan card: badge, title, price, description, and action button.

  Rendered by `PricingSection` and `Subscription.Item`. It takes plain props and
  calls nothing, so reach for it only when replacing the card entirely rather
  than composing one.
-->
<script lang="ts">
  import CheckoutButton from "./CheckoutButton.svelte";
  import NumberInput from "./NumberInput.svelte";
  import type {
    UIPlanEntry,
    RecurringCycle,
    ScheduledSubscriptionUpdate,
  } from "../../core/types.js";
  import {
    defaultBillingLabels,
    type BillingCurrencyFormatInput,
    type BillingLabels,
  } from "../../core/i18n.js";
  import type { ConnectedProduct } from "../widgets/types.js";
  import {
    resolveProductIdForPlan,
    formatPriceWithInterval,
    formatUnitPriceBreakdown,
    splitPriceLabel,
  } from "../../core/display.js";
  import { renderMarkdown } from "../../core/markdown.js";

  interface Props {
    plan: UIPlanEntry;
    selectedCycle?: RecurringCycle;
    activePlanId?: string | null;
    subscriptionProductId?: string | null;
    subscriptionStatus?: string | null;
    subscriptionTrialEnd?: string | null;
    scheduledUpdate?: ScheduledSubscriptionUpdate | null;
    scheduledEffectiveDate?: string | null;
    products?: ConnectedProduct[];
    units?: number;
    showUnitPicker?: boolean;
    /**
     * Reserve the trial caption line even when this plan has no trial, so every
     * card in a grid keeps the same rows below the CTA. Set by the parent, which
     * is the only place that knows whether a sibling plan offers a trial.
     */
    reserveTrialCaption?: boolean;
    subscribedUnits?: number | null;
    isGroupSubscribed?: boolean;
    disableCheckout?: boolean;
    disableSwitch?: boolean;
    disableUnits?: boolean;
    className?: string;
    onCheckout?: (payload: {
      plan: UIPlanEntry;
      productId: string;
      units?: number;
    }) => Promise<void> | void;
    onSwitchPlan?: (payload: {
      plan: UIPlanEntry;
      productId?: string;
      appPlanId?: string;
      freePlanId?: string;
      units?: number;
    }) => Promise<void> | void;
    onUpdateUnits?: (payload: { units: number }) => Promise<void> | void;
    onContactSales?: (payload: { plan: UIPlanEntry }) => Promise<void> | void;
    onCancelSubscription?: () => void;
    labels?: BillingLabels;
    formatCurrency?: (input: BillingCurrencyFormatInput) => string;
  }

  let {
    plan,
    selectedCycle = undefined,
    activePlanId = undefined,
    subscriptionProductId = null,
    subscriptionStatus = null,
    subscriptionTrialEnd = null,
    scheduledUpdate = null,
    scheduledEffectiveDate = null,
    products = [],
    units = undefined,
    showUnitPicker = false,
    reserveTrialCaption = false,
    subscribedUnits = null,
    isGroupSubscribed = false,
    disableCheckout = false,
    disableSwitch = false,
    disableUnits = false,
    className = "",
    onCheckout,
    onSwitchPlan,
    onUpdateUnits,
    onContactSales,
    onCancelSubscription,
    labels = defaultBillingLabels,
    formatCurrency = undefined,
  }: Props = $props();

  const isUnitPlan = $derived(plan.pricingModel === "unit");
  let unitCount = $derived(units ?? 1);
  let unitAdjustCount = $state(1);
  let editingUnits = $state(false);
  $effect(() => {
    unitAdjustCount = subscribedUnits ?? units ?? 1;
    editingUnits = false;
  });
  const effectiveUnits = $derived(
    isUnitPlan ? (showUnitPicker ? unitCount : units) : undefined,
  );

  const productId = $derived(resolveProductIdForPlan(plan, selectedCycle));
  const priceLabel = $derived(
    formatPriceWithInterval(productId, products, labels, formatCurrency),
  );

  // Exact match: user is subscribed to THIS specific product (plan + cycle)
  const isActiveProduct = $derived(
    subscriptionProductId != null && productId != null && productId === subscriptionProductId,
  );
  const isTrialing = $derived(isActiveProduct && subscriptionStatus === "trialing");
  const trialDaysLeft = $derived.by(() => {
    if (!isTrialing || !subscriptionTrialEnd) return null;
    const end = new Date(subscriptionTrialEnd).getTime();
    const now = Date.now();
    const days = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    return days;
  });
  // Same plan but different billing cycle — offer to switch interval
  const isActivePlanOtherCycle = $derived(
    !isActiveProduct && activePlanId === plan.planId && productId != null,
  );
  // Free plan is active when activePlanId matches and the plan has no product (no subscription)
  const isActiveFreePlan = $derived(
    !isActiveProduct &&
      (plan.category === "free" || plan.category === "trial") &&
      activePlanId === plan.planId,
  );
  // Sibling plan in the same <Subscription> group that already has a subscription
  const isSiblingPlan = $derived(
    !isActiveProduct && !isActivePlanOtherCycle && isGroupSubscribed && productId != null && plan.category !== "free" && plan.category !== "trial" && plan.category !== "enterprise",
  );
  const isFreeDowngrade = $derived(
    !isActiveFreePlan && plan.category === "free" && isGroupSubscribed,
  );
  const isAppPlanActivation = $derived(
    !isActiveFreePlan &&
      (plan.category === "free" || plan.category === "trial") &&
      !isGroupSubscribed,
  );
  const isScheduledTarget = $derived(
    scheduledUpdate?.status === "pending" &&
      ((scheduledUpdate.targetProductId != null &&
        productId != null &&
        scheduledUpdate.targetProductId === productId) ||
        (scheduledUpdate.targetPlanId != null &&
          scheduledUpdate.targetPlanId === plan.planId)),
  );
  const scheduledTargetLabel = $derived(
    scheduledEffectiveDate
      ? labels.subscription.scheduledPlanWithDate(scheduledEffectiveDate)
      : labels.subscription.scheduledPlan,
  );
  const showUnitCheckoutControls = $derived(
    isUnitPlan && showUnitPicker && !isActiveProduct && !isSiblingPlan && !isScheduledTarget,
  );
  const reserveUnitActionHeight = $derived(
    isUnitPlan && showUnitPicker && (isActiveProduct || isSiblingPlan || isActivePlanOtherCycle),
  );

  const inheritedUnits = $derived(
    isUnitPlan && (isActiveProduct || isSiblingPlan || isActivePlanOtherCycle)
      ? subscribedUnits
      : null,
  );
  const unitPriceBreakdown = $derived(
    inheritedUnits != null
      ? formatUnitPriceBreakdown(
          productId,
          products,
          inheritedUnits,
          labels,
          formatCurrency,
        )
      : null,
  );
  const unitsChanged = $derived(
    isActiveProduct && isUnitPlan && subscribedUnits != null && unitAdjustCount !== subscribedUnits,
  );

  // A catalog-declared Creem trial is offered only before the subscription
  // exists. Once it does, the live countdown from `trialEnd` takes over.
  const offersCatalogTrial = $derived(
    !isActiveProduct &&
      !isActivePlanOtherCycle &&
      !isSiblingPlan &&
      !isGroupSubscribed &&
      plan.billingType !== "onetime" &&
      (plan.trialDays ?? 0) > 0,
  );
  const checkoutLabel = $derived(
    isActivePlanOtherCycle
      ? labels.subscription.switchInterval
      : isSiblingPlan || isFreeDowngrade
        ? labels.subscription.switchPlan
        : isAppPlanActivation
          ? plan.category === "trial"
            ? labels.subscription.startTrial
            : labels.subscription.getStarted
        : plan.billingType === "onetime"
          ? labels.subscription.buyNow
          : offersCatalogTrial
            ? labels.subscription.startFreeTrial
            : labels.subscription.subscribe,
  );
  const handleCheckout = (payload: { productId: string }) => {
    if ((isSiblingPlan || isActivePlanOtherCycle) && onSwitchPlan) {
      onSwitchPlan({ plan, productId: payload.productId, units: isUnitPlan ? (subscribedUnits ?? effectiveUnits) : effectiveUnits });
    } else {
      onCheckout?.({ plan, productId: payload.productId, units: effectiveUnits });
    }
  };
  const handleAppPlanSwitch = () => {
    onSwitchPlan?.({
      plan,
      appPlanId: plan.planId,
      ...(plan.category === "free" ? { freePlanId: plan.planId } : {}),
    });
  };

  const splitPrice = $derived(splitPriceLabel(unitPriceBreakdown?.total ?? priceLabel));

  const descriptionHtml = $derived(renderMarkdown(plan.description));
</script>

<section
  class={`relative flex flex-col rounded-2xl bg-surface-base p-6 ${
    plan.recommended ? "border-2 border-primary-border-default" : ""
  } ${className}`}
>
  <div class="mb-3 flex h-5 items-center justify-between gap-2">
    <h3 class="title-s text-foreground-default">
      {plan.title ?? plan.planId}
    </h3>
    {#if isActiveProduct || isActiveFreePlan}
      <span class="badge-faded-sm">
        {#if isTrialing}
          {labels.subscription.freeTrial}{#if trialDaysLeft != null}&ensp;·&ensp;{labels.subscription.trialDaysLeft(trialDaysLeft)}{/if}
        {:else}
          {labels.subscription.currentPlan}
        {/if}
      </span>
    {:else if isScheduledTarget}
      <span class="badge-filled-sm">
        {labels.subscription.scheduledPlan}
      </span>
    {:else if plan.recommended}
      <span class="badge-filled-sm">
        {labels.subscription.recommended}
      </span>
    {/if}
  </div>

  <div class="flex items-baseline gap-1">
    {#if plan.category === "free"}
      <span class="heading-s text-foreground-default">{labels.subscription.free}</span>
    {:else if plan.category === "trial"}
      <span class="heading-s text-foreground-default">{labels.subscription.freeTrial}</span>
    {:else if plan.category === "enterprise"}
      <span class="heading-s text-foreground-default">{labels.subscription.custom}</span>
    {:else if splitPrice}
      <span class="heading-s text-foreground-default">{splitPrice.main}</span>
      {#if splitPrice.suffix}
        <span class="title-s text-foreground-placeholder">{splitPrice.suffix}</span>
      {/if}
      {#if splitPrice.tail}
        <span class="title-s text-foreground-placeholder">{splitPrice.tail}</span>
      {/if}
    {/if}
  </div>
  {#if unitPriceBreakdown?.calculation}
    <p class="label-m mt-1 text-foreground-placeholder">
      {unitPriceBreakdown.calculation}
    </p>
  {/if}


  <div class={`mb-4 mt-6 flex flex-col ${showUnitCheckoutControls ? "gap-2" : "min-h-8"}`}>
    {#if showUnitCheckoutControls}
      <div class="flex w-full items-center justify-between rounded-xl bg-surface-subtle py-2 pl-4 pr-2">
        <span class="label-m text-foreground-default">{labels.subscription.units}</span>
        <NumberInput
          value={unitCount}
          min={1}
          compact
          disabled={disableUnits}
          decreaseLabel={labels.accessibility.decreaseValue}
          increaseLabel={labels.accessibility.increaseValue}
          onValueChange={(next) => {
            if (next > 0) unitCount = next;
          }}
        />
      </div>
    {/if}

    <div
      class={`${showUnitCheckoutControls ? "w-full" : "flex min-h-8 items-start w-full"} ${
        reserveUnitActionHeight ? "min-h-[4.5rem]" : ""
      }`}
    >
    {#if isActiveProduct && isUnitPlan && showUnitPicker && onUpdateUnits}
      <div class="flex w-full flex-col gap-2">
        {#if editingUnits}
          <div class="flex w-full items-center justify-between rounded-xl bg-surface-subtle py-2 pl-4 pr-2">
            <span class="label-m text-foreground-default">{labels.subscription.units}</span>
            <NumberInput
              value={unitAdjustCount}
              min={1}
              compact
              disabled={disableUnits}
              decreaseLabel={labels.accessibility.decreaseValue}
              increaseLabel={labels.accessibility.increaseValue}
              onValueChange={(next) => {
                if (next > 0) unitAdjustCount = next;
              }}
            />
          </div>
          <div class="flex w-full items-center gap-2">
            <button
              type="button"
              class="button-faded h-8 w-full"
              onclick={() => { unitAdjustCount = subscribedUnits ?? 1; editingUnits = false; }}
            >
              {labels.common.cancel}
            </button>
            <button
              type="button"
              disabled={disableUnits || !unitsChanged}
              class="button-filled h-8 w-full disabled:cursor-not-allowed disabled:opacity-50"
              onclick={() => onUpdateUnits?.({ units: unitAdjustCount })}
            >
              {labels.subscription.update}
            </button>
          </div>
        {:else}
          <button type="button" class="button-faded w-full" onclick={() => editingUnits = true}>
            {labels.subscription.changeUnits}
          </button>
          {#if onCancelSubscription}
            <button type="button" class="button-outline w-full" onclick={onCancelSubscription}>
              {labels.subscription.cancelSubscription}
            </button>
          {/if}
        {/if}
      </div>
    {:else if isActiveProduct && onCancelSubscription}
      <button type="button" class="button-outline w-full" onclick={onCancelSubscription}>
        {labels.subscription.cancelSubscription}
      </button>
    {:else if isActiveProduct || isActiveFreePlan}
      <!-- Keep CTA row height but intentionally empty when current plan has no action -->
    {:else if isScheduledTarget}
      <button
        type="button"
        disabled
        class="button-faded w-full cursor-not-allowed opacity-70"
      >
        {scheduledTargetLabel}
      </button>
    {:else if (isSiblingPlan || isActivePlanOtherCycle) && productId}
      <CheckoutButton
        {productId}
        disabled={disableSwitch}
        onCheckout={handleCheckout}
        {labels}
        className={`${plan.recommended ? "button-filled" : "button-faded"} w-full`}
      >
        {checkoutLabel}
      </CheckoutButton>
    {:else if isFreeDowngrade}
      <button
        type="button"
        disabled={disableSwitch}
        class="button-faded w-full disabled:cursor-not-allowed disabled:opacity-50"
        onclick={handleAppPlanSwitch}
      >
        {checkoutLabel}
      </button>
    {:else if isAppPlanActivation && onSwitchPlan}
      <button
        type="button"
        disabled={disableSwitch}
        class="button-faded w-full disabled:cursor-not-allowed disabled:opacity-50"
        onclick={handleAppPlanSwitch}
      >
        {checkoutLabel}
      </button>
    {:else if plan.category === "enterprise"}
      {#if plan.contactUrl}
        <a
          href={plan.contactUrl}
          class="button-outline w-full"
        >
          {labels.subscription.contactSales}
        </a>
      {:else if onContactSales}
        <button
          type="button"
          class="button-outline w-full"
          onclick={() => onContactSales?.({ plan })}
        >
          {labels.subscription.contactSales}
        </button>
      {/if}
    {:else if productId}
        <CheckoutButton
          {productId}
          disabled={disableCheckout}
          onCheckout={handleCheckout}
          {labels}
          className={`${plan.recommended ? "button-filled" : "button-faded"} w-full`}
        >
          {checkoutLabel}
        </CheckoutButton>
      {:else if plan.category !== "free" && plan.category !== "trial"}
        <span class="body-m text-foreground-muted">
          {labels.subscription.configureCheckout}
        </span>
      {/if}
    </div>
    {#if offersCatalogTrial}
      <p class="label-m mt-2 text-foreground-placeholder">
        {labels.subscription.trialDaysFree(plan.trialDays ?? 0)}
      </p>
    {:else if reserveTrialCaption}
      <!-- Non-breaking space keeps the row height identical to a captioned card. -->
      <p aria-hidden="true" class="label-m mt-2 text-foreground-placeholder">&nbsp;</p>
    {/if}
  </div>

  {#if descriptionHtml}
    <div class="creem-prose w-full pt-4 body-m text-foreground-default">
      <!-- eslint-disable-next-line svelte/no-at-html-tags — merchant-authored markdown from Creem -->
      {@html descriptionHtml}
    </div>
  {/if}
</section>
