import { useMemo, useState } from "react";
import { CheckoutButton } from "./CheckoutButton.js";
import { NumberInput } from "./NumberInput.js";
import type { UIPlanEntry, RecurringCycle } from "../../core/types.js";
import type { ConnectedProduct } from "../widgets/types.js";
import {
  resolveProductIdForPlan,
  formatPriceWithInterval,
  formatSeatPrice,
  splitPriceLabel,
} from "../shared.js";
import { renderMarkdown } from "../../core/markdown.js";

const computeTrialDays = (trialEnd: string): number => {
  const end = new Date(trialEnd).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
};

export const PricingCard = ({
  plan,
  selectedCycle,
  activePlanId,
  subscriptionProductId,
  subscriptionStatus,
  subscriptionTrialEnd,
  products = [],
  units,
  showSeatPicker = false,
  subscribedSeats,
  isGroupSubscribed = false,
  disableCheckout = false,
  disableSwitch = false,
  disableSeats = false,
  className = "",
  onCheckout,
  onSwitchPlan,
  onUpdateSeats,
  onContactSales,
  onCancelSubscription,
}: {
  plan: UIPlanEntry;
  selectedCycle?: RecurringCycle;
  activePlanId?: string | null;
  subscriptionProductId?: string | null;
  subscriptionStatus?: string | null;
  subscriptionTrialEnd?: string | null;
  products?: ConnectedProduct[];
  units?: number;
  showSeatPicker?: boolean;
  subscribedSeats?: number | null;
  isGroupSubscribed?: boolean;
  disableCheckout?: boolean;
  disableSwitch?: boolean;
  disableSeats?: boolean;
  className?: string;
  onCheckout?: (payload: {
    plan: UIPlanEntry;
    productId: string;
    units?: number;
  }) => Promise<void> | void;
  onSwitchPlan?: (payload: {
    plan: UIPlanEntry;
    productId: string;
    units?: number;
  }) => Promise<void> | void;
  onUpdateSeats?: (payload: { units: number }) => Promise<void> | void;
  onContactSales?: (payload: { plan: UIPlanEntry }) => Promise<void> | void;
  onCancelSubscription?: () => void;
}) => {
  const isSeatPlan = plan.pricingModel === "seat";
  const [seatCount, setSeatCount] = useState(units ?? 1);
  const [seatAdjustCount, setSeatAdjustCount] = useState(
    subscribedSeats ?? units ?? 1,
  );
  const [editingSeats, setEditingSeats] = useState(false);

  const [prevUnits, setPrevUnits] = useState(units);
  const [prevSubscribedSeats, setPrevSubscribedSeats] =
    useState(subscribedSeats);

  if (units !== prevUnits) {
    setPrevUnits(units);
    setSeatCount(units ?? 1);
  }
  if (subscribedSeats !== prevSubscribedSeats || units !== prevUnits) {
    setPrevSubscribedSeats(subscribedSeats);
    setSeatAdjustCount(subscribedSeats ?? units ?? 1);
    setEditingSeats(false);
  }

  const effectiveUnits = isSeatPlan
    ? showSeatPicker
      ? seatCount
      : units
    : undefined;

  const productId = resolveProductIdForPlan(plan, selectedCycle);
  const priceLabel = formatPriceWithInterval(productId, products);

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
    plan.category === "free" &&
    activePlanId === plan.planId;
  // Sibling plan in the same <Subscription> group that already has a subscription
  const isSiblingPlan =
    !isActiveProduct &&
    !isActivePlanOtherCycle &&
    isGroupSubscribed &&
    productId != null &&
    plan.category !== "free" &&
    plan.category !== "enterprise";

  const showSeatCheckoutControls =
    isSeatPlan && showSeatPicker && !isActiveProduct && !isSiblingPlan;
  const reserveSeatActionHeight =
    isSeatPlan &&
    showSeatPicker &&
    (isActiveProduct || isSiblingPlan || isActivePlanOtherCycle);

  const seatPriceLabel =
    isActiveProduct && isSeatPlan && subscribedSeats
      ? formatSeatPrice(productId, products, subscribedSeats)
      : null;
  const seatsChanged =
    isActiveProduct &&
    isSeatPlan &&
    subscribedSeats != null &&
    seatAdjustCount !== subscribedSeats;

  const checkoutLabel = isActivePlanOtherCycle
    ? "Switch interval"
    : isSiblingPlan
      ? "Switch plan"
      : plan.billingType === "onetime"
        ? "Buy now"
        : "Subscribe";

  const handleCheckout = (payload: { productId: string }) => {
    if ((isSiblingPlan || isActivePlanOtherCycle) && onSwitchPlan) {
      onSwitchPlan({
        plan,
        productId: payload.productId,
        units: isSeatPlan
          ? (subscribedSeats ?? effectiveUnits)
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

  const splitPrice = splitPriceLabel(seatPriceLabel ?? priceLabel);

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
                Free trial
                {trialDaysLeft != null && (
                  <>
                    &ensp;·&ensp;{trialDaysLeft} day
                    {trialDaysLeft === 1 ? "" : "s"} left
                  </>
                )}
              </>
            ) : (
              "Current plan"
            )}
          </span>
        ) : plan.recommended ? (
          <span className="badge-filled-sm">Recommended</span>
        ) : null}
      </div>

      <div className="flex items-baseline gap-1">
        {plan.category === "free" ? (
          <span className="heading-s text-foreground-default">Free</span>
        ) : plan.category === "enterprise" ? (
          <span className="heading-s text-foreground-default">Custom</span>
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


      <div
        className={`mb-4 mt-6 ${showSeatCheckoutControls ? "flex flex-col gap-2" : "flex min-h-8 items-start"}`}
      >
        {showSeatCheckoutControls && (
          <div className="flex w-full items-center justify-between rounded-xl bg-surface-subtle py-2 pl-4 pr-2">
            <span className="label-m text-foreground-default">Seats:</span>
            <NumberInput
              value={seatCount}
              min={1}
              compact
              disabled={disableSeats}
              onValueChange={(next) => {
                if (next > 0) setSeatCount(next);
              }}
            />
          </div>
        )}

        <div
          className={`${showSeatCheckoutControls ? "w-full" : "flex min-h-8 items-start w-full"} ${
            reserveSeatActionHeight ? "min-h-[4.5rem]" : ""
          }`}
        >
          {isActiveProduct && isSeatPlan && showSeatPicker && onUpdateSeats ? (
            <div className="flex w-full flex-col gap-2">
              {editingSeats ? (
                <>
                  <div className="flex w-full items-center justify-between rounded-xl bg-surface-subtle py-2 pl-4 pr-2">
                    <span className="label-m text-foreground-default">
                      Seats:
                    </span>
                    <NumberInput
                      value={seatAdjustCount}
                      min={1}
                      compact
                      disabled={disableSeats}
                      onValueChange={(next) => {
                        if (next > 0) setSeatAdjustCount(next);
                      }}
                    />
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <button
                      type="button"
                      className="button-faded h-8 w-full"
                      onClick={() => {
                        setSeatAdjustCount(subscribedSeats ?? 1);
                        setEditingSeats(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={disableSeats || !seatsChanged}
                      className="button-filled h-8 w-full disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() =>
                        onUpdateSeats?.({ units: seatAdjustCount })
                      }
                    >
                      Update
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="button-faded w-full"
                    onClick={() => setEditingSeats(true)}
                  >
                    Change seats
                  </button>
                  {onCancelSubscription && (
                    <button
                      type="button"
                      className="button-outline w-full"
                      onClick={onCancelSubscription}
                    >
                      Cancel subscription
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
              Cancel subscription
            </button>
          ) : isActiveProduct ||
            isActiveFreePlan ? /* Keep CTA row height but intentionally empty when current plan has no action */
          null : (isSiblingPlan || isActivePlanOtherCycle) && productId ? (
            <CheckoutButton
              productId={productId}
              disabled={disableSwitch}
              onCheckout={handleCheckout}
              className={`${plan.recommended ? "button-filled" : "button-faded"} w-full`}
            >
              {checkoutLabel}
            </CheckoutButton>
          ) : plan.category === "enterprise" ? (
            plan.contactUrl ? (
              <a href={plan.contactUrl} className="button-outline w-full">
                Contact sales
              </a>
            ) : onContactSales ? (
              <button
                type="button"
                className="button-outline w-full"
                onClick={() => onContactSales?.({ plan })}
              >
                Contact sales
              </button>
            ) : null
          ) : productId ? (
            <CheckoutButton
              productId={productId}
              disabled={disableCheckout}
              onCheckout={handleCheckout}
              className={`${plan.recommended ? "button-filled" : "button-faded"} w-full`}
            >
              {checkoutLabel}
            </CheckoutButton>
          ) : plan.category !== "free" ? (
            <span className="body-m text-foreground-muted">
              Configure a checkout handler to activate this plan.
            </span>
          ) : null}
        </div>
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
