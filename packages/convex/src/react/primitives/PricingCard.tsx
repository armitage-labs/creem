import { useMemo, useState } from "react";
import { CheckoutButton } from "./CheckoutButton.js";
import { NumberInput } from "./NumberInput.js";
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

const computeTrialDays = (trialEnd: string): number => {
  const end = new Date(trialEnd).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
};

/**
 * A single plan card: badge, title, price, description, and action button.
 *
 * Rendered by `PricingSection` and `Subscription.Item`. It takes plain props and
 * calls nothing, so reach for it only when replacing the card entirely rather
 * than composing one.
 */
export const PricingCard = ({
  plan,
  selectedCycle,
  activePlanId,
  subscriptionProductId,
  subscriptionStatus,
  subscriptionTrialEnd,
  scheduledUpdate,
  scheduledEffectiveDate,
  products = [],
  units,
  showUnitPicker = false,
  reserveTrialCaption = false,
  subscribedUnits,
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
  formatCurrency,
}: {
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
}) => {
  const isUnitPlan = plan.pricingModel === "unit";
  const [unitCount, setUnitCount] = useState(units ?? 1);
  const [unitAdjustCount, setUnitAdjustCount] = useState(
    subscribedUnits ?? units ?? 1,
  );
  const [editingUnits, setEditingUnits] = useState(false);

  const [prevUnits, setPrevUnits] = useState(units);
  const [prevSubscribedUnits, setPrevSubscribedUnits] =
    useState(subscribedUnits);

  if (units !== prevUnits) {
    setPrevUnits(units);
    setUnitCount(units ?? 1);
  }
  if (subscribedUnits !== prevSubscribedUnits || units !== prevUnits) {
    setPrevSubscribedUnits(subscribedUnits);
    setUnitAdjustCount(subscribedUnits ?? units ?? 1);
    setEditingUnits(false);
  }

  const effectiveUnits = isUnitPlan
    ? showUnitPicker
      ? unitCount
      : units
    : undefined;

  const productId = resolveProductIdForPlan(plan, selectedCycle);
  const priceLabel = formatPriceWithInterval(
    productId,
    products,
    labels,
    formatCurrency,
  );

  // Exact match: user is subscribed to THIS specific product (plan + cycle)
  const isActiveProduct =
    subscriptionProductId != null &&
    productId != null &&
    productId === subscriptionProductId;
  const isTrialing = isActiveProduct && subscriptionStatus === "trialing";
  const trialDaysLeft =
    isTrialing && subscriptionTrialEnd
      ? computeTrialDays(subscriptionTrialEnd)
      : null;

  // Same plan but different billing cycle — offer to switch interval
  const isActivePlanOtherCycle =
    !isActiveProduct && activePlanId === plan.planId && productId != null;
  // Free plan is active when activePlanId matches and the plan has no product
  const isActiveFreePlan =
    !isActiveProduct &&
    (plan.category === "free" || plan.category === "trial") &&
    activePlanId === plan.planId;
  // Sibling plan in the same <Subscription> group that already has a subscription
  const isSiblingPlan =
    !isActiveProduct &&
    !isActivePlanOtherCycle &&
    isGroupSubscribed &&
    productId != null &&
    plan.category !== "free" &&
    plan.category !== "trial" &&
    plan.category !== "enterprise";
  const isFreeDowngrade =
    !isActiveFreePlan && plan.category === "free" && isGroupSubscribed;
  const isAppPlanActivation =
    !isActiveFreePlan &&
    (plan.category === "free" || plan.category === "trial") &&
    !isGroupSubscribed;
  const isScheduledTarget =
    scheduledUpdate?.status === "pending" &&
    ((scheduledUpdate.targetProductId != null &&
      productId != null &&
      scheduledUpdate.targetProductId === productId) ||
      (scheduledUpdate.targetPlanId != null &&
        scheduledUpdate.targetPlanId === plan.planId));
  const scheduledTargetLabel = scheduledEffectiveDate
    ? labels.subscription.scheduledPlanWithDate(scheduledEffectiveDate)
    : labels.subscription.scheduledPlan;

  const showUnitCheckoutControls =
    isUnitPlan &&
    showUnitPicker &&
    !isActiveProduct &&
    !isSiblingPlan &&
    !isScheduledTarget;
  const reserveUnitActionHeight =
    isUnitPlan &&
    showUnitPicker &&
    (isActiveProduct || isSiblingPlan || isActivePlanOtherCycle);

  const inheritedUnits =
    isUnitPlan && (isActiveProduct || isSiblingPlan || isActivePlanOtherCycle)
      ? subscribedUnits
      : null;
  const unitPriceBreakdown =
    inheritedUnits != null
      ? formatUnitPriceBreakdown(
          productId,
          products,
          inheritedUnits,
          labels,
          formatCurrency,
        )
      : null;
  const unitsChanged =
    isActiveProduct &&
    isUnitPlan &&
    subscribedUnits != null &&
    unitAdjustCount !== subscribedUnits;

  // A catalog-declared Creem trial is offered only before the subscription
  // exists. Once it does, the live countdown from `trialEnd` takes over.
  const offersCatalogTrial =
    !isActiveProduct &&
    !isActivePlanOtherCycle &&
    !isSiblingPlan &&
    !isGroupSubscribed &&
    plan.billingType !== "onetime" &&
    (plan.trialDays ?? 0) > 0;

  const checkoutLabel = isActivePlanOtherCycle
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
            : labels.subscription.subscribe;

  const handleCheckout = (payload: { productId: string }) => {
    if ((isSiblingPlan || isActivePlanOtherCycle) && onSwitchPlan) {
      onSwitchPlan({
        plan,
        productId: payload.productId,
        units: isUnitPlan
          ? (subscribedUnits ?? effectiveUnits)
          : effectiveUnits,
      });
    } else {
      onCheckout?.({
        plan,
        productId: payload.productId,
        units: effectiveUnits,
      });
    }
  };

  const handleAppPlanSwitch = () => {
    onSwitchPlan?.({
      plan,
      appPlanId: plan.planId,
      ...(plan.category === "free" ? { freePlanId: plan.planId } : {}),
    });
  };

  const splitPrice = splitPriceLabel(unitPriceBreakdown?.total ?? priceLabel);

  const descriptionHtml = useMemo(
    () => renderMarkdown(plan.description),
    [plan.description],
  );

  return (
    <section
      className={`relative flex flex-col rounded-2xl bg-surface-base p-6 ${
        plan.recommended ? "border-2 border-primary-border-default" : ""
      } ${className}`}
    >
      <div className="mb-3 flex h-5 items-center justify-between gap-2">
        <h3 className="title-s text-foreground-default">
          {plan.title ?? plan.planId}
        </h3>
        {isActiveProduct || isActiveFreePlan ? (
          <span className="badge-faded-sm">
            {isTrialing ? (
              <>
                {labels.subscription.freeTrial}
                {trialDaysLeft != null && (
                  <>
                    &ensp;·&ensp;
                    {labels.subscription.trialDaysLeft(trialDaysLeft)}
                  </>
                )}
              </>
            ) : (
              labels.subscription.currentPlan
            )}
          </span>
        ) : isScheduledTarget ? (
          <span className="badge-filled-sm">
            {labels.subscription.scheduledPlan}
          </span>
        ) : plan.recommended ? (
          <span className="badge-filled-sm">
            {labels.subscription.recommended}
          </span>
        ) : null}
      </div>

      <div className="flex items-baseline gap-1">
        {plan.category === "free" ? (
          <span className="heading-s text-foreground-default">
            {labels.subscription.free}
          </span>
        ) : plan.category === "trial" ? (
          <span className="heading-s text-foreground-default">
            {labels.subscription.freeTrial}
          </span>
        ) : plan.category === "enterprise" ? (
          <span className="heading-s text-foreground-default">
            {labels.subscription.custom}
          </span>
        ) : splitPrice ? (
          <>
            <span className="heading-s text-foreground-default">
              {splitPrice.main}
            </span>
            {splitPrice.suffix && (
              <span className="title-s text-foreground-placeholder">
                {splitPrice.suffix}
              </span>
            )}
            {splitPrice.tail && (
              <span className="title-s text-foreground-placeholder">
                {splitPrice.tail}
              </span>
            )}
          </>
        ) : null}
      </div>
      {unitPriceBreakdown?.calculation && (
        <p className="label-m mt-1 text-foreground-placeholder">
          {unitPriceBreakdown.calculation}
        </p>
      )}
      <div
        className={`mb-4 mt-6 flex flex-col ${showUnitCheckoutControls ? "gap-2" : "min-h-8"}`}
      >
        {showUnitCheckoutControls && (
          <div className="flex w-full items-center justify-between rounded-xl bg-surface-subtle py-2 pl-4 pr-2">
            <span className="label-m text-foreground-default">
              {labels.subscription.units}
            </span>
            <NumberInput
              value={unitCount}
              min={1}
              compact
              disabled={disableUnits}
              decreaseLabel={labels.accessibility.decreaseValue}
              increaseLabel={labels.accessibility.increaseValue}
              onValueChange={(next) => {
                if (next > 0) setUnitCount(next);
              }}
            />
          </div>
        )}

        <div
          className={`${showUnitCheckoutControls ? "w-full" : "flex min-h-8 items-start w-full"} ${
            reserveUnitActionHeight ? "min-h-[4.5rem]" : ""
          }`}
        >
          {isActiveProduct && isUnitPlan && showUnitPicker && onUpdateUnits ? (
            <div className="flex w-full flex-col gap-2">
              {editingUnits ? (
                <>
                  <div className="flex w-full items-center justify-between rounded-xl bg-surface-subtle py-2 pl-4 pr-2">
                    <span className="label-m text-foreground-default">
                      {labels.subscription.units}
                    </span>
                    <NumberInput
                      value={unitAdjustCount}
                      min={1}
                      compact
                      disabled={disableUnits}
                      decreaseLabel={labels.accessibility.decreaseValue}
                      increaseLabel={labels.accessibility.increaseValue}
                      onValueChange={(next) => {
                        if (next > 0) setUnitAdjustCount(next);
                      }}
                    />
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <button
                      type="button"
                      className="button-faded h-8 w-full"
                      onClick={() => {
                        setUnitAdjustCount(subscribedUnits ?? 1);
                        setEditingUnits(false);
                      }}
                    >
                      {labels.common.cancel}
                    </button>
                    <button
                      type="button"
                      disabled={disableUnits || !unitsChanged}
                      className="button-filled h-8 w-full disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() =>
                        onUpdateUnits?.({ units: unitAdjustCount })
                      }
                    >
                      {labels.subscription.update}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="button-faded w-full"
                    onClick={() => setEditingUnits(true)}
                  >
                    {labels.subscription.changeUnits}
                  </button>
                  {onCancelSubscription && (
                    <button
                      type="button"
                      className="button-outline w-full"
                      onClick={onCancelSubscription}
                    >
                      {labels.subscription.cancelSubscription}
                    </button>
                  )}
                </>
              )}
            </div>
          ) : isActiveProduct && onCancelSubscription ? (
            <button
              type="button"
              className="button-outline w-full"
              onClick={onCancelSubscription}
            >
              {labels.subscription.cancelSubscription}
            </button>
          ) : isActiveProduct ||
            isActiveFreePlan /* Keep CTA row height but intentionally empty when current plan has no action */ ? null : isScheduledTarget ? (
            <button
              type="button"
              disabled
              className="button-faded w-full cursor-not-allowed opacity-70"
            >
              {scheduledTargetLabel}
            </button>
          ) : (isSiblingPlan || isActivePlanOtherCycle) && productId ? (
            <CheckoutButton
              productId={productId}
              disabled={disableSwitch}
              onCheckout={handleCheckout}
              labels={labels}
              className={`${plan.recommended ? "button-filled" : "button-faded"} w-full`}
            >
              {checkoutLabel}
            </CheckoutButton>
          ) : isFreeDowngrade ? (
            <button
              type="button"
              disabled={disableSwitch}
              onClick={handleAppPlanSwitch}
              className="button-faded w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkoutLabel}
            </button>
          ) : isAppPlanActivation && onSwitchPlan ? (
            <button
              type="button"
              disabled={disableSwitch}
              onClick={handleAppPlanSwitch}
              className="button-faded w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkoutLabel}
            </button>
          ) : plan.category === "enterprise" ? (
            plan.contactUrl ? (
              <a href={plan.contactUrl} className="button-outline w-full">
                {labels.subscription.contactSales}
              </a>
            ) : onContactSales ? (
              <button
                type="button"
                className="button-outline w-full"
                onClick={() => onContactSales?.({ plan })}
              >
                {labels.subscription.contactSales}
              </button>
            ) : null
          ) : productId ? (
            <CheckoutButton
              productId={productId}
              disabled={disableCheckout}
              onCheckout={handleCheckout}
              labels={labels}
              className={`${plan.recommended ? "button-filled" : "button-faded"} w-full`}
            >
              {checkoutLabel}
            </CheckoutButton>
          ) : plan.category !== "free" && plan.category !== "trial" ? (
            <span className="body-m text-foreground-muted">
              {labels.subscription.configureCheckout}
            </span>
          ) : null}
        </div>
        {(offersCatalogTrial || reserveTrialCaption) && (
          <p
            aria-hidden={!offersCatalogTrial}
            className="label-m mt-2 text-foreground-placeholder"
          >
            {offersCatalogTrial
              ? labels.subscription.trialDaysFree(plan.trialDays ?? 0)
              : /* Non-breaking space keeps the row height identical to a captioned card. */
                "\u00A0"}
          </p>
        )}
      </div>

      {descriptionHtml && (
        <div
          className="creem-prose w-full pt-4 body-m text-foreground-default"
          dangerouslySetInnerHTML={{ __html: descriptionHtml }}
        />
      )}
    </section>
  );
};
