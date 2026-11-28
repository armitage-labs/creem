<!--
  @component
  The plans as one single choice: a radio list, each option with its title,
  description and price, and one checkout button for the plan chosen.

  What `Subscription.Root layout="choice"` renders in place of the card grid.
  Like `PricingSection`, it takes plain props and calls nothing. The parts are
  Ark UI's radio group, so they carry `data-scope="radio-group"`, `data-part`
  and `data-state="checked"` for styling; with `unstyled` only the classes you
  pass apply.
-->
<script lang="ts">
  import {
    RadioGroup,
    type RadioGroupValueChangeDetails,
  } from "@ark-ui/svelte/radio-group";
  import { untrack } from "svelte";
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

  interface Props {
    plans?: UIPlanEntry[];
    selectedCycle?: RecurringCycle;
    products?: ConnectedProduct[];
    /** The subscribed product, offered as the current plan and not chosen. */
    subscriptionProductId?: string | null;
    /** The plan chosen at first. Defaults to the recommended plan, then the first. */
    defaultPlanId?: string;
    disableCheckout?: boolean;
    unstyled?: boolean;
    class?: string;
    /** Classes for each option. */
    itemClass?: string;
    /** Classes for the checkout button. */
    actionClass?: string;
    onCheckout?: (payload: {
      plan: UIPlanEntry;
      productId: string;
    }) => Promise<void> | void;
    labels?: BillingLabels;
    formatCurrency?: (input: BillingCurrencyFormatInput) => string;
  }

  let {
    plans = [],
    selectedCycle = undefined,
    products = [],
    subscriptionProductId = null,
    defaultPlanId = undefined,
    disableCheckout = false,
    unstyled = false,
    class: className = "",
    itemClass = "",
    actionClass = "",
    onCheckout,
    labels = defaultBillingLabels,
    formatCurrency = undefined,
  }: Props = $props();

  const options = $derived(
    choosablePlans(plans, selectedCycle, subscriptionProductId),
  );
  let chosen = $state<string | null>(
    untrack(() =>
      initialChoice(
        choosablePlans(plans, selectedCycle, subscriptionProductId),
        defaultPlanId,
      ),
    ),
  );
  // A choice that is no longer offered (another cycle, a new subscription)
  // falls back to the default one.
  const value = $derived(
    options.some((option) => option.plan.planId === chosen && !option.current)
      ? chosen
      : initialChoice(options, defaultPlanId),
  );
  let isLoading = $state(false);

  const checkout = () => {
    const option = options.find((candidate) => candidate.plan.planId === value);
    if (!option?.productId || !onCheckout || isLoading) return;
    isLoading = true;
    Promise.resolve(
      onCheckout({ plan: option.plan, productId: option.productId }),
    ).finally(() => {
      isLoading = false;
    });
  };
</script>

<div class={unstyled ? className : `flex flex-col gap-4 ${className}`}>
  <RadioGroup.Root
    value={value ?? undefined}
    disabled={disableCheckout || isLoading}
    aria-label={labels.subscription.choosePlan}
    class={unstyled ? "" : "flex flex-col gap-2"}
    onValueChange={(details: RadioGroupValueChangeDetails) => {
      if (details.value) chosen = details.value;
    }}
  >
    {#each options as option (option.plan.planId)}
      {@const descriptionHtml = renderMarkdown(option.plan.description)}
      <RadioGroup.Item
        value={option.plan.planId}
        disabled={option.current || !option.productId}
        class={unstyled
          ? itemClass
          : `flex cursor-pointer items-start gap-3 rounded-2xl border border-transparent bg-surface-base p-4 data-[state=checked]:border-primary-border-default data-disabled:cursor-not-allowed ${itemClass}`}
      >
        <RadioGroup.ItemControl
          class={unstyled
            ? ""
            : "mt-0.5 size-4 shrink-0 rounded-full border border-foreground-placeholder data-[state=checked]:border-[5px] data-[state=checked]:border-primary-border-default"}
        />
        <span class={unstyled ? "" : "flex min-w-0 flex-1 flex-col gap-1"}>
          <RadioGroup.ItemText
            class={unstyled ? "" : "title-s text-foreground-default"}
          >
            {option.plan.title ?? option.plan.planId}
            {#if option.current}
              <span class={unstyled ? "" : "badge-faded-sm ml-2"}>
                {labels.subscription.currentPlan}
              </span>
            {/if}
          </RadioGroup.ItemText>
          {#if descriptionHtml}
            <span
              class={unstyled
                ? ""
                : "creem-prose body-m text-foreground-muted"}
            >
              <!-- eslint-disable-next-line svelte/no-at-html-tags — merchant-authored markdown from Creem -->
              {@html descriptionHtml}
            </span>
          {/if}
        </span>
        <span
          class={unstyled
            ? ""
            : "shrink-0 whitespace-nowrap text-right body-m text-foreground-default"}
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
    {/each}
  </RadioGroup.Root>

  <div class={unstyled ? "" : "flex justify-end"}>
    <button
      type="button"
      class={unstyled
        ? actionClass
        : `button-filled disabled:cursor-not-allowed disabled:opacity-60 ${actionClass}`}
      disabled={disableCheckout || isLoading || !value || !onCheckout}
      aria-busy={isLoading}
      data-part="checkout"
      onclick={checkout}
    >
      {isLoading ? labels.checkout.loading : labels.subscription.continueToCheckout}
    </button>
  </div>
</div>
