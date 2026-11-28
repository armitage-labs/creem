import { RadioGroup } from "@ark-ui/react/radio-group";
import { useMemo, useState } from "react";
import type { RecurringCycle, UIPlanEntry } from "../../core/types.js";
import {
  defaultBillingLabels,
  type BillingCurrencyFormatInput,
  type BillingLabels,
} from "../../core/i18n.js";
import type { ConnectedProduct } from "../widgets/types.js";
import { formatPriceWithInterval } from "../../core/display.js";
import { renderMarkdown } from "../../core/markdown.js";
import { choosablePlans, initialChoice } from "../../core/planChoice.js";

export type PlanChoiceProps = {
  plans?: UIPlanEntry[];
  selectedCycle?: RecurringCycle;
  products?: ConnectedProduct[];
  /** The subscribed product, offered as the current plan and not chosen. */
  subscriptionProductId?: string | null;
  /** The plan chosen at first. Defaults to the recommended plan, then the first. */
  defaultPlanId?: string;
  disableCheckout?: boolean;
  unstyled?: boolean;
  className?: string;
  /** Classes for each option. */
  itemClassName?: string;
  /** Classes for the checkout button. */
  actionClassName?: string;
  onCheckout?: (payload: {
    plan: UIPlanEntry;
    productId: string;
  }) => Promise<void> | void;
  labels?: BillingLabels;
  formatCurrency?: (input: BillingCurrencyFormatInput) => string;
};

/**
 * The plans as one single choice: a radio list, each option with its title,
 * description and price, and one checkout button for the plan chosen.
 *
 * What `<Subscription.Root layout="choice">` renders in place of the card
 * grid. Like `PricingSection`, it takes plain props and calls nothing. The
 * parts are Ark UI's radio group, so they carry `data-scope="radio-group"`,
 * `data-part` and `data-state="checked"` for styling; with `unstyled` only the
 * classes you pass apply.
 */
export function PlanChoice({
  plans = [],
  selectedCycle,
  products = [],
  subscriptionProductId = null,
  defaultPlanId,
  disableCheckout = false,
  unstyled = false,
  className = "",
  itemClassName = "",
  actionClassName = "",
  onCheckout,
  labels = defaultBillingLabels,
  formatCurrency,
}: PlanChoiceProps) {
  const options = useMemo(
    () => choosablePlans(plans, selectedCycle, subscriptionProductId),
    [plans, selectedCycle, subscriptionProductId],
  );
  const [chosen, setChosen] = useState<string | null>(() =>
    initialChoice(options, defaultPlanId),
  );
  // A choice that is no longer offered (another cycle, a new subscription)
  // falls back to the default one.
  const value = options.some(
    (option) => option.plan.planId === chosen && !option.current,
  )
    ? chosen
    : initialChoice(options, defaultPlanId);
  const [isLoading, setIsLoading] = useState(false);

  const checkout = () => {
    const option = options.find((candidate) => candidate.plan.planId === value);
    if (!option?.productId || !onCheckout || isLoading) return;
    setIsLoading(true);
    void Promise.resolve(
      onCheckout({ plan: option.plan, productId: option.productId }),
    ).finally(() => setIsLoading(false));
  };

  return (
    <div className={unstyled ? className : `flex flex-col gap-4 ${className}`}>
      <RadioGroup.Root
        value={value}
        disabled={disableCheckout || isLoading}
        aria-label={labels.subscription.choosePlan}
        className={unstyled ? "" : "flex flex-col gap-2"}
        onValueChange={(details) => {
          if (details.value) setChosen(details.value);
        }}
      >
        {options.map((option) => {
          const descriptionHtml = renderMarkdown(option.plan.description);
          return (
            <RadioGroup.Item
              key={option.plan.planId}
              value={option.plan.planId}
              disabled={option.current || !option.productId}
              className={
                unstyled
                  ? itemClassName
                  : `flex cursor-pointer items-start gap-3 rounded-2xl border border-transparent bg-surface-base p-4 data-[state=checked]:border-primary-border-default data-disabled:cursor-not-allowed ${itemClassName}`
              }
            >
              <RadioGroup.ItemControl
                className={
                  unstyled
                    ? ""
                    : "mt-0.5 size-4 shrink-0 rounded-full border border-foreground-placeholder data-[state=checked]:border-[5px] data-[state=checked]:border-primary-border-default"
                }
              />
              <span
                className={unstyled ? "" : "flex min-w-0 flex-1 flex-col gap-1"}
              >
                <RadioGroup.ItemText
                  className={unstyled ? "" : "title-s text-foreground-default"}
                >
                  {option.plan.title ?? option.plan.planId}
                  {option.current && (
                    <span className={unstyled ? "" : "badge-faded-sm ml-2"}>
                      {labels.subscription.currentPlan}
                    </span>
                  )}
                </RadioGroup.ItemText>
                {descriptionHtml && (
                  <span
                    className={
                      unstyled ? "" : "creem-prose body-m text-foreground-muted"
                    }
                    // Merchant-authored markdown from Creem, as on the pricing card.
                    dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                  />
                )}
              </span>
              <span
                className={
                  unstyled
                    ? ""
                    : "shrink-0 whitespace-nowrap text-right body-m text-foreground-default"
                }
                data-part="price"
              >
                {formatPriceWithInterval(
                  option.productId,
                  products,
                  labels,
                  formatCurrency,
                )}
              </span>
              <RadioGroup.ItemHiddenInput />
            </RadioGroup.Item>
          );
        })}
      </RadioGroup.Root>

      <div className={unstyled ? "" : "flex justify-end"}>
        <button
          type="button"
          className={
            unstyled
              ? actionClassName
              : `button-filled disabled:cursor-not-allowed disabled:opacity-60 ${actionClassName}`
          }
          disabled={disableCheckout || isLoading || !value || !onCheckout}
          aria-busy={isLoading}
          data-part="checkout"
          onClick={checkout}
        >
          {isLoading
            ? labels.checkout.loading
            : labels.subscription.continueToCheckout}
        </button>
      </div>
    </div>
  );
}
