import { useState, type PropsWithChildren } from "react";
import { NumberInput } from "../primitives/NumberInput.js";
import { useSubscriptionItem } from "./subscriptionItemContext.js";

/**
 * Renders the plan title from item context.
 *
 * Must be used inside a `<Subscription.Item>` with children (styled composition
 * mode).
 */
export const SubscriptionItemTitle = ({
  className = "",
}: {
  className?: string;
}) => {
  const { plan, unstyled } = useSubscriptionItem();
  return (
    <h3
      className={unstyled ? className : `creem-base:font-semibold ${className}`}
    >
      {plan.title}
    </h3>
  );
};

/**
 * Renders the plan price from item context.
 *
 * Must be used inside a `<Subscription.Item>` with children (styled composition
 * mode).
 */
export const SubscriptionItemPrice = ({
  className = "",
}: {
  className?: string;
}) => {
  const { price, unstyled } = useSubscriptionItem();
  if (!price) return null;
  return (
    <p
      className={
        unstyled
          ? className
          : `creem-base:text-2xl creem-base:font-bold ${className}`
      }
    >
      {price}
    </p>
  );
};

/**
 * Renders the secondary unit-price calculation from item context.
 *
 * Must be used inside a `<Subscription.Item>` with children.
 */
export const SubscriptionItemPriceCaption = ({
  className = "",
}: {
  className?: string;
}) => {
  const { priceCaption, unstyled } = useSubscriptionItem();
  if (!priceCaption) return null;
  return (
    <p
      className={
        unstyled
          ? className
          : `creem-base:text-sm creem-base:text-foreground-placeholder ${className}`
      }
    >
      {priceCaption}
    </p>
  );
};

/**
 * Renders the plan description from item context.
 *
 * Must be used inside a `<Subscription.Item>` with children (styled composition
 * mode).
 */
export const SubscriptionItemDescription = ({
  className = "",
}: {
  className?: string;
}) => {
  const { plan, unstyled } = useSubscriptionItem();
  if (!plan.description) return null;
  return (
    <p
      className={
        unstyled
          ? className
          : `creem-base:text-sm creem-base:text-zinc-500 dark:creem-base:text-zinc-400 ${className}`
      }
    >
      {plan.description}
    </p>
  );
};

/**
 * Renders the plan CTA button from item context.
 *
 * Shows different labels/states based on whether the plan is active, available
 * for checkout, or switchable. Must be used inside a `<Subscription.Item>` with
 * children (styled composition mode).
 */
export const SubscriptionItemCTA = ({
  className = "",
  activeLabel,
  checkoutLabel,
  switchLabel,
}: {
  className?: string;
  activeLabel?: string;
  checkoutLabel?: string;
  switchLabel?: string;
}) => {
  const {
    isActive,
    isScheduledTarget,
    scheduledEffectiveDate,
    onCheckout,
    onSwitch,
    unstyled,
    labels,
  } = useSubscriptionItem();
  const activeClassName = unstyled
    ? className
    : `creem-base:w-full creem-base:rounded-lg creem-base:bg-zinc-100 creem-base:px-4 creem-base:py-2 creem-base:text-sm creem-base:font-medium creem-base:text-zinc-500 dark:creem-base:bg-zinc-800 dark:creem-base:text-zinc-400 ${className}`;
  const actionClassName = unstyled
    ? className
    : `creem-base:button-filled creem-base:w-full ${className}`;

  if (isActive) {
    return (
      <button type="button" className={activeClassName} disabled>
        {activeLabel ?? labels.subscription.currentPlan}
      </button>
    );
  }

  if (onSwitch) {
    return (
      <button type="button" className={actionClassName} onClick={onSwitch}>
        {switchLabel ?? labels.subscription.switchPlan}
      </button>
    );
  }

  if (isScheduledTarget) {
    return (
      <button type="button" className={activeClassName} disabled>
        {scheduledEffectiveDate
          ? labels.subscription.scheduledPlanWithDate(scheduledEffectiveDate)
          : labels.subscription.scheduledPlan}
      </button>
    );
  }

  if (onCheckout) {
    return (
      <button type="button" className={actionClassName} onClick={onCheckout}>
        {checkoutLabel ?? labels.subscription.getStarted}
      </button>
    );
  }

  return null;
};

/**
 * Renders the active subscription cancel action from item context.
 *
 * Must be used inside a `<Subscription.Item>` with children.
 */
export const SubscriptionCancel = ({
  className = "",
  label,
}: {
  className?: string;
  label?: string;
}) => {
  const { isActive, onCancelSubscription, unstyled, labels } =
    useSubscriptionItem();
  if (!isActive || !onCancelSubscription) return null;

  const resolvedClassName = unstyled
    ? className
    : `creem-base:button-outline creem-base:w-full ${className}`;

  return (
    <button
      type="button"
      className={resolvedClassName}
      onClick={onCancelSubscription}
    >
      {label ?? labels.subscription.cancelSubscription}
    </button>
  );
};

/**
 * Renders a unit picker for unit-based plans from item context.
 *
 * Must be used inside a `<Subscription.Item>` with children.
 */
export const SubscriptionUnitPicker = ({
  className,
  class: classProp,
  rowClassName = "",
  labelClassName = "",
  actionsClassName = "",
  secondaryClassName = "",
  primaryClassName = "",
  numberInputClassName = "",
  label,
  changeLabel,
  updateLabel,
  cancelLabel,
  detailed = false,
}: {
  className?: string;
  class?: string;
  rowClassName?: string;
  labelClassName?: string;
  actionsClassName?: string;
  secondaryClassName?: string;
  primaryClassName?: string;
  numberInputClassName?: string;
  label?: string;
  changeLabel?: string;
  updateLabel?: string;
  cancelLabel?: string;
  detailed?: boolean;
}) => {
  const ctx = useSubscriptionItem();
  const resolvedLabel = label ?? ctx.labels.subscription.units;
  const resolvedChangeLabel =
    changeLabel ?? ctx.labels.subscription.changeUnits;
  const resolvedUpdateLabel = updateLabel ?? ctx.labels.subscription.update;
  const resolvedCancelLabel = cancelLabel ?? ctx.labels.common.cancel;
  const [editing, setEditing] = useState(false);
  const [draftUnits, setDraftUnits] = useState(
    ctx.subscribedUnits ?? ctx.checkoutUnits,
  );
  const isUnitPlan = ctx.plan.pricingModel === "unit";
  const resolvedClassName = className ?? classProp ?? "";
  const outerClassName = ctx.unstyled
    ? resolvedClassName
    : `creem-base:flex creem-base:w-full creem-base:flex-col creem-base:gap-2 ${resolvedClassName}`;
  const resolvedRowClassName = ctx.unstyled
    ? rowClassName
    : `creem-base:flex creem-base:w-full creem-base:items-center creem-base:justify-between creem-base:rounded-xl creem-base:bg-surface-subtle creem-base:py-2 creem-base:pl-4 creem-base:pr-2 ${rowClassName}`;
  const resolvedLabelClassName = ctx.unstyled
    ? labelClassName
    : `creem-base:label-m creem-base:text-foreground-default ${labelClassName}`;
  const resolvedActionsClassName = ctx.unstyled
    ? actionsClassName
    : `creem-base:flex creem-base:w-full creem-base:items-center creem-base:gap-2 ${actionsClassName}`;
  const resolvedSecondaryClassName = ctx.unstyled
    ? secondaryClassName
    : `creem-base:button-faded creem-base:h-8 creem-base:w-full ${secondaryClassName}`;
  const resolvedPrimaryClassName = ctx.unstyled
    ? primaryClassName
    : `creem-base:button-filled creem-base:h-8 creem-base:w-full creem-base:disabled:cursor-not-allowed creem-base:disabled:opacity-50 ${primaryClassName}`;

  if (!isUnitPlan) return null;
  if (ctx.isSwitchPlan) return null;

  if (ctx.isActive) {
    if (!ctx.onUpdateUnits) {
      return (
        <div className={outerClassName}>
          <div className={resolvedRowClassName}>
            <span className={resolvedLabelClassName}>{resolvedLabel}</span>
            <span>{ctx.subscribedUnits ?? ctx.checkoutUnits}</span>
          </div>
        </div>
      );
    }

    if (!editing) {
      return (
        <div className={outerClassName}>
          {detailed && (
            <div className={resolvedRowClassName}>
              <span className={resolvedLabelClassName}>{resolvedLabel}</span>
              <span>{ctx.subscribedUnits ?? ctx.checkoutUnits}</span>
            </div>
          )}
          <button
            type="button"
            className={resolvedSecondaryClassName}
            disabled={ctx.disableUnits}
            onClick={() => {
              setDraftUnits(ctx.subscribedUnits ?? ctx.checkoutUnits);
              setEditing(true);
            }}
          >
            {resolvedChangeLabel}
          </button>
        </div>
      );
    }

    const unitsChanged =
      ctx.subscribedUnits != null && draftUnits !== ctx.subscribedUnits;

    return (
      <div className={outerClassName}>
        <div className={resolvedRowClassName}>
          <span className={resolvedLabelClassName}>{resolvedLabel}</span>
          <NumberInput
            value={draftUnits}
            min={1}
            compact
            disabled={ctx.disableUnits}
            className={numberInputClassName}
            decreaseLabel={ctx.labels.accessibility.decreaseValue}
            increaseLabel={ctx.labels.accessibility.increaseValue}
            onValueChange={(next) => {
              if (next > 0) setDraftUnits(next);
            }}
          />
        </div>
        <div className={resolvedActionsClassName}>
          <button
            type="button"
            className={resolvedSecondaryClassName}
            onClick={() => {
              setDraftUnits(ctx.subscribedUnits ?? ctx.checkoutUnits);
              setEditing(false);
            }}
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            className={resolvedPrimaryClassName}
            disabled={ctx.disableUnits || !unitsChanged}
            onClick={() => ctx.onUpdateUnits?.(draftUnits)}
          >
            {resolvedUpdateLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={outerClassName}>
      <div className={resolvedRowClassName}>
        <span className={resolvedLabelClassName}>{resolvedLabel}</span>
        <NumberInput
          value={ctx.checkoutUnits}
          min={1}
          compact
          disabled={ctx.disableUnits}
          className={numberInputClassName}
          decreaseLabel={ctx.labels.accessibility.decreaseValue}
          increaseLabel={ctx.labels.accessibility.increaseValue}
          onValueChange={ctx.setCheckoutUnits}
        />
      </div>
    </div>
  );
};

/**
 * Renders a badge on a plan card (e.g. "Popular", "Recommended", "Best for
 * teams").
 *
 * Must be used inside a `<Subscription.Item>` with children (styled composition
 * mode).
 */
export const SubscriptionItemBadge = ({
  label,
  className = "",
  children,
}: PropsWithChildren<{
  label?: string;
  className?: string;
}>) => {
  const { isRecommended, isActive, unstyled, labels } = useSubscriptionItem();
  const text =
    label ??
    (isActive
      ? labels.subscription.current
      : isRecommended
        ? labels.subscription.recommended
        : null);
  if (!text && !children) return null;
  return (
    <span
      className={
        unstyled
          ? className
          : `creem-base:inline-block creem-base:rounded-full creem-base:bg-blue-100 creem-base:px-2.5 creem-base:py-0.5 creem-base:text-xs creem-base:font-medium creem-base:text-blue-800 dark:creem-base:bg-blue-900/30 dark:creem-base:text-blue-300 ${className}`
      }
    >
      {children ?? text}
    </span>
  );
};
