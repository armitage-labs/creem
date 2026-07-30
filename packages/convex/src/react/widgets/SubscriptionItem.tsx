import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { RecurringCycle } from "../../core/types.js";
import { defaultBillingLabels } from "../../core/i18n.js";
import { SubscriptionContext } from "./subscriptionContext.js";
import { SubscriptionItemContext } from "./subscriptionItemContext.js";
import { PricingCard } from "../primitives/PricingCard.js";
import {
  formatPriceWithInterval,
  formatUnitPriceBreakdown,
  resolveProductIdForPlan,
} from "../../core/display.js";
import { resolvePlanTarget } from "../../core/planTarget.js";

type BaseProps = {
  planId?: string;
  title?: string;
  description?: string;
  groupId?: string;
  groupTitle?: string;
  recommended?: boolean;
  className?: string;
  class?: string;
};

type Props =
  | (BaseProps & {
      type?: undefined;
      productIds?: undefined;
      contactUrl?: string;
    })
  | (BaseProps & {
      type: "free";
      productIds?: undefined;
      contactUrl?: string;
    })
  | (BaseProps & {
      type: "single";
      productIds?: Partial<Record<RecurringCycle, string>>;
      contactUrl?: string;
    })
  | (BaseProps & {
      type: "unit-based";
      productIds?: Partial<Record<RecurringCycle, string>>;
      contactUrl?: string;
    })
  | (BaseProps & {
      type: "enterprise";
      productIds?: undefined;
      contactUrl: string;
    });

export const SubscriptionItem = ({
  planId,
  type,
  title,
  description,
  groupId,
  groupTitle,
  contactUrl,
  recommended,
  productIds,
  className,
  class: classProp,
  children,
}: PropsWithChildren<Props>) => {
  const rootContext = useContext(SubscriptionContext);
  const resolvedClassName = className ?? classProp ?? "";
  const resolvedPlanId = planId ?? Object.values(productIds ?? {})[0] ?? type;

  useEffect(() => {
    if (!rootContext) return;
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
    const unregister = rootContext.registerPlan(registration);
    return unregister;
  }, [
    rootContext,
    planId,
    type,
    title,
    description,
    groupId,
    groupTitle,
    contactUrl,
    recommended,
    productIds,
    resolvedPlanId,
  ]);

  const plan = resolvedPlanId
    ? rootContext?.getPlan(resolvedPlanId)
    : undefined;
  const visible = resolvedPlanId
    ? (rootContext?.isPlanVisible(resolvedPlanId) ?? false)
    : false;
  const productId = plan
    ? resolveProductIdForPlan(plan, rootContext?.selectedCycle)
    : undefined;
  const planTarget = plan ? resolvePlanTarget(plan, productId) : null;
  const isActiveProduct =
    rootContext?.subscriptionProductId != null &&
    productId != null &&
    productId === rootContext.subscriptionProductId;
  const isActivePlanOtherCycle =
    !isActiveProduct &&
    rootContext?.activePlanId === plan?.planId &&
    productId != null;
  const isActiveAppPlan =
    !isActiveProduct &&
    planTarget?.kind === "app-plan" &&
    rootContext?.activePlanId === plan?.planId;
  const isAppPlan = planTarget?.kind === "app-plan";
  const isSiblingPlan =
    !isActiveProduct &&
    !isActivePlanOtherCycle &&
    rootContext?.isGroupSubscribed === true &&
    planTarget?.kind === "creem-product";
  const isScheduledTarget =
    rootContext?.scheduledUpdate?.status === "pending" &&
    ((rootContext.scheduledUpdate.targetProductId != null &&
      productId != null &&
      rootContext.scheduledUpdate.targetProductId === productId) ||
      (rootContext.scheduledUpdate.targetPlanId != null &&
        rootContext.scheduledUpdate.targetPlanId === plan?.planId));
  const rootUnits = rootContext?.units ?? 1;
  const [checkoutUnitState, setCheckoutUnitState] = useState({
    sourceUnits: rootUnits,
    units: rootUnits,
  });
  const checkoutUnits =
    checkoutUnitState.sourceUnits === rootUnits
      ? checkoutUnitState.units
      : rootUnits;

  const effectiveUnits =
    plan?.pricingModel === "unit"
      ? children
        ? checkoutUnits
        : rootContext?.showUnitPicker
          ? (rootContext?.units ?? 1)
          : rootContext?.units
      : undefined;

  const setItemCheckoutUnits = useCallback(
    (next: number) => {
      if (next > 0) {
        setCheckoutUnitState({ sourceUnits: rootUnits, units: next });
      }
    },
    [rootUnits],
  );

  const itemContext = useMemo(() => {
    if (!plan) return undefined;
    const inheritedUnits =
      plan.pricingModel === "unit" &&
      (isActiveProduct || isSiblingPlan || isActivePlanOtherCycle)
        ? (rootContext?.subscribedUnits ?? checkoutUnits)
        : null;
    const unitPriceBreakdown =
      inheritedUnits != null
        ? formatUnitPriceBreakdown(
            productId,
            rootContext?.products ?? [],
            inheritedUnits,
            rootContext?.labels,
            rootContext?.formatCurrency,
          )
        : null;
    const price =
      plan.category === "free"
        ? (rootContext?.labels.subscription.free ??
          defaultBillingLabels.subscription.free)
        : plan.category === "trial"
          ? (rootContext?.labels.subscription.freeTrial ??
            defaultBillingLabels.subscription.freeTrial)
          : planTarget?.kind === "app-plan" || plan.category === "enterprise"
            ? (rootContext?.labels.subscription.custom ??
              defaultBillingLabels.subscription.custom)
            : (unitPriceBreakdown?.total ??
              formatPriceWithInterval(
                productId,
                rootContext?.products ?? [],
                rootContext?.labels ?? defaultBillingLabels,
                rootContext?.formatCurrency,
              ));

    return {
      plan,
      isActive: isActiveProduct || isActiveAppPlan,
      isSwitchPlan: isSiblingPlan || isActivePlanOtherCycle,
      isScheduledTarget,
      scheduledEffectiveDate: rootContext?.scheduledEffectiveDate ?? null,
      isRecommended: plan.recommended === true,
      selectedCycle: rootContext?.selectedCycle ?? "every-month",
      currentProductId: productId,
      price,
      priceCaption: unitPriceBreakdown?.calculation ?? null,
      checkoutUnits,
      subscribedUnits: rootContext?.subscribedUnits ?? null,
      disableUnits: rootContext?.disableUnits ?? false,
      unstyled: rootContext?.unstyled ?? false,
      labels: rootContext?.labels ?? defaultBillingLabels,
      setCheckoutUnits: setItemCheckoutUnits,
      onCheckout:
        rootContext &&
        productId &&
        !isActiveProduct &&
        !isActiveAppPlan &&
        !isSiblingPlan &&
        !isActivePlanOtherCycle &&
        !isScheduledTarget
          ? () =>
              rootContext.checkout({ plan, productId, units: effectiveUnits })
          : undefined,
      onSwitch:
        rootContext &&
        !isScheduledTarget &&
        isAppPlan &&
        !isActiveAppPlan &&
        !rootContext.isGroupSubscribed
          ? () =>
              rootContext.switchPlan?.({
                plan,
                appPlanId: planTarget.appPlanId,
              })
          : rootContext &&
              !isScheduledTarget &&
              productId &&
              (isSiblingPlan || isActivePlanOtherCycle)
            ? () =>
                rootContext.switchPlan?.({
                  plan,
                  productId,
                  units:
                    plan.pricingModel === "unit"
                      ? (rootContext.subscribedUnits ?? effectiveUnits)
                      : effectiveUnits,
                })
            : undefined,
      onUpdateUnits: rootContext?.updateUnits
        ? (units: number) => rootContext.updateUnits?.({ units })
        : undefined,
      onCancelSubscription:
        isActiveProduct || isActiveAppPlan
          ? rootContext?.cancelSubscription
          : undefined,
    };
  }, [
    plan,
    productId,
    rootContext,
    isActiveProduct,
    isActiveAppPlan,
    isAppPlan,
    isSiblingPlan,
    isActivePlanOtherCycle,
    isScheduledTarget,
    planTarget,
    checkoutUnits,
    effectiveUnits,
    setItemCheckoutUnits,
  ]);

  if (!rootContext || !plan || !visible || !itemContext) return null;

  if (children) {
    return (
      <SubscriptionItemContext.Provider value={itemContext}>
        <section className={resolvedClassName}>{children}</section>
      </SubscriptionItemContext.Provider>
    );
  }

  return (
    <PricingCard
      plan={plan}
      selectedCycle={rootContext.selectedCycle}
      activePlanId={rootContext.activePlanId}
      subscriptionProductId={rootContext.subscriptionProductId}
      subscriptionStatus={rootContext.subscriptionStatus}
      subscriptionTrialEnd={rootContext.subscriptionTrialEnd}
      scheduledUpdate={rootContext.scheduledUpdate}
      scheduledEffectiveDate={rootContext.scheduledEffectiveDate}
      products={rootContext.products}
      units={rootContext.units}
      showUnitPicker={rootContext.showUnitPicker}
      reserveTrialCaption={rootContext.reserveTrialCaption}
      subscribedUnits={rootContext.subscribedUnits}
      isGroupSubscribed={rootContext.isGroupSubscribed}
      disableCheckout={rootContext.disableCheckout}
      disableSwitch={rootContext.disableSwitch}
      disableUnits={rootContext.disableUnits}
      className={resolvedClassName}
      onCheckout={rootContext.checkout}
      onSwitchPlan={rootContext.switchPlan}
      onUpdateUnits={rootContext.updateUnits}
      onCancelSubscription={rootContext.cancelSubscription}
      labels={rootContext.labels}
      formatCurrency={rootContext.formatCurrency}
    />
  );
};
