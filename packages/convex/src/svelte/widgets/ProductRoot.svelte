<script lang="ts">
  import { getContext, setContext, untrack } from "svelte";
  import { useConvexClient, useQuery } from "convex-svelte";
  import {
    formatPriceWithInterval,
    splitPriceLabel,
  } from "../../core/display.js";
  import { resolveBillingI18n } from "../../core/i18n.js";
  import {
    PRODUCT_GROUP_CONTEXT_KEY,
    type ProductGroupContextValue,
  } from "./productGroupContext.js";
  import {
    CREEM_CONVEX_CONTEXT_KEY,
    type CreemConvexContextValue,
  } from "../creemConvexContext.js";
  import type {
    BillingPermissions,
    CheckoutIntent,
    ConnectedBillingModel,
    ProductItemRegistration,
    Transition,
  } from "./types.js";
  import { SvelteSet } from "svelte/reactivity";
  import { renderMarkdown } from "../../core/markdown.js";
  import { pendingCheckout } from "../../core/pendingCheckout.js";
  import { getConvexErrorMessage } from "../../core/convexError.js";
  import {
    getActiveOwnedProductId,
    getEffectiveOwnedProductIds,
    isOwnedProduct,
    resolveProductCheckoutProductId,
    shouldSuppressPendingCheckout,
  } from "../../core/productCheckout.js";

  interface Props {
    /** Local UI permission overrides for this product root. */
    permissions?: BillingPermissions;
    /** Upgrade path rules for mutually exclusive one-time products. */
    transition?: Transition[];
    /** Wrapper CSS class. */
    class?: string;
    /** Product card layout mode. */
    layout?: "default" | "single";
    /** Visual style variant for product cards. */
    styleVariant?: "legacy" | "pricing";
    /** Show synced Creem product images when available. */
    showImages?: boolean;
    /** CTA style used by the pricing visual variant. */
    pricingCtaVariant?: "filled" | "faded";
    /** Checkout success URL override. Defaults to Creem product success URL, then the current page. */
    successUrl?: string;
    /** Optional checkout guard for this product root. Overrides provider guard. */
    onBeforeCheckout?: (intent: CheckoutIntent) => Promise<boolean> | boolean;
    /** Product items registered inside this root. */
    children?: import("svelte").Snippet;
  }

  let {
    permissions = undefined,
    transition = [],
    class: className = "",
    layout = "default",
    styleVariant = "legacy",
    showImages = false,
    pricingCtaVariant = "faded",
    successUrl = undefined,
    onBeforeCheckout = undefined,
    children,
  }: Props = $props();

  const provider = getContext<CreemConvexContextValue | undefined>(
    CREEM_CONVEX_CONTEXT_KEY,
  );
  const resolvedApi = provider?.api;
  if (!resolvedApi) {
    throw new Error(
      "Product.Root must be rendered inside <CreemConvexProvider>.",
    );
  }
  const resolvedPermissions = $derived(permissions ?? provider?.permissions);
  const resolvedOnBeforeCheckout = $derived(
    onBeforeCheckout ?? provider?.onBeforeCheckout,
  );
  const i18n = $derived(resolveBillingI18n(provider?.i18n));

  const client = useConvexClient();

  const billingUiModelRef = resolvedApi.uiModel;
  const checkoutLinkRef = resolvedApi.checkouts.create;

  const billingModelQuery = useQuery(billingUiModelRef, {});

  let registeredItems = $state<ProductItemRegistration[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  const contextValue: ProductGroupContextValue = {
    registerItem: (item) => {
      registeredItems = [
        ...registeredItems.filter(
          (candidate) => candidate.productId !== item.productId,
        ),
        item,
      ];
      return () => {
        registeredItems = registeredItems.filter(
          (candidate) => candidate.productId !== item.productId,
        );
      };
    },
  };

  setContext(PRODUCT_GROUP_CONTEXT_KEY, contextValue);

  const model = $derived(
    (billingModelQuery.data ?? null) as ConnectedBillingModel | null,
  );
  const canCheckout = $derived(
    !model?.user && resolvedOnBeforeCheckout != null
      ? true
      : resolvedPermissions?.canCheckout !== false,
  );
  const allProducts = $derived(model?.allProducts ?? []);
  const rawOwnedProductIds = $derived(model?.ownedProductIds ?? []);

  $effect(() => {
    if (!model?.user) return;
    untrack(() => {
      const pending = pendingCheckout.load();
      if (!pending) return;
      if (
        shouldSuppressPendingCheckout(
          pending.productId,
          registeredItems,
          effectiveOwnedProductIds,
        )
      ) {
        pendingCheckout.clear();
        return;
      }
      startCheckout(pending.productId);
    });
  });

  // Resolve effective ownership by applying transition rules.
  // If the user purchased a "via_product" (upgrade delta), they effectively
  // own the transition target ('to') and no longer just the source ('from').
  const effectiveOwnedProductIds = $derived(
    getEffectiveOwnedProductIds(rawOwnedProductIds, transition),
  );

  const activeOwnedProductId = $derived(
    getActiveOwnedProductId(registeredItems, effectiveOwnedProductIds),
  );

  // Determine if a product is a lower tier than the target by traversing the
  // transition graph (from → to edges). Returns true if there is a path from
  // `productId` to `targetId`, meaning `productId` is a lower tier.
  const isLowerTierThan = (productId: string, targetId: string): boolean => {
    const visited = new SvelteSet<string>();
    const queue = [productId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const rule of transition) {
        if (rule.from === current) {
          if (rule.to === targetId) return true;
          queue.push(rule.to);
        }
      }
    }
    return false;
  };

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

  const startCheckout = async (checkoutProductId: string) => {
    if (resolvedOnBeforeCheckout) {
      const proceed = await resolvedOnBeforeCheckout({ productId: checkoutProductId });
      if (!proceed) return;
    }
    isLoading = true;
    error = null;
    try {
      const { url } = await client.action(checkoutLinkRef, {
        productId: checkoutProductId,
        ...(successUrl ? { successUrl } : {}),
        fallbackSuccessUrl: getFallbackSuccessUrl(),
        theme: getPreferredTheme(),
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
    } catch (checkoutError) {
      error = getConvexErrorMessage(
        checkoutError,
        i18n.labels.product.checkoutFailed,
      );
      isLoading = false;
    }
  };

  const handleCheckoutClick = (event: MouseEvent, productId: string) => {
    event.preventDefault();
    event.stopPropagation();
    void startCheckout(productId);
  };

</script>

<div class="hidden" aria-hidden="true">
  {@render children?.()}
</div>

<section
  class={`${styleVariant === "pricing" ? "space-y-0" : "space-y-3"} ${className}`}
>
  {#if error}
    <p class="text-sm text-red-600">{error}</p>
  {/if}

  <div
    class={styleVariant === "pricing"
      ? layout === "single"
        ? "flex justify-center"
        : "grid grid-cols-1 gap-1 lg:grid-cols-2"
      : `flex gap-3 ${layout === "single" ? "justify-center" : "flex-wrap items-center"}`}
  >
    {#each registeredItems as item (item.productId)}
      {@const isOwned = isOwnedProduct(item, effectiveOwnedProductIds)}
      {@const isIncluded =
        !isOwned &&
        activeOwnedProductId != null &&
        isLowerTierThan(item.productId, activeOwnedProductId)}
      {@const checkoutProductId = resolveProductCheckoutProductId(
        item,
        activeOwnedProductId,
        transition,
      )}
      {@const matchedProduct = allProducts.find((p) => p.id === item.productId)}
      {@const resolvedTitle =
        item.title ?? matchedProduct?.name ?? item.productId}
      {@const resolvedDescription =
        item.description ?? matchedProduct?.description}
      {@const resolvedImageUrl = matchedProduct?.imageUrl}
      {@const resolvedPrice = formatPriceWithInterval(
        item.productId,
        allProducts,
        i18n.labels,
        i18n.formatCurrency,
      )}
      {@const splitPrice = splitPriceLabel(resolvedPrice)}
      {@const descriptionHtml = renderMarkdown(resolvedDescription)}
      <article
        class={styleVariant === "pricing"
          ? `w-full ${layout === "single" ? "max-w-[680px]" : "max-w-none"} rounded-2xl bg-surface-base ${isIncluded ? "opacity-60" : ""}`
          : `max-w-sm rounded-xl border p-4 shadow-sm ${isIncluded ? "border-zinc-100 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900" : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"}`}
      >
        {#if styleVariant === "pricing"}
          {#if showImages && resolvedImageUrl}
            <div class="p-1">
              <img
                src={resolvedImageUrl}
                alt={resolvedTitle}
                class="aspect-[16/9] w-full rounded-xl object-cover"
                loading="lazy"
              />
            </div>
          {/if}

          <div class="px-6 pb-6 pt-6">
            <div class="mb-3 flex min-h-6 items-center justify-between gap-2">
              <h3 class="title-s text-foreground-default">{resolvedTitle}</h3>
              {#if isOwned}
                <span class="badge-faded-sm">{i18n.labels.product.owned}</span>
              {:else if isIncluded}
                <span class="badge-faded-sm">{i18n.labels.product.included}</span>
              {/if}
            </div>

            {#if splitPrice}
              <div class="flex items-baseline gap-1">
                <span class="heading-s text-foreground-default"
                  >{splitPrice.main}</span
                >
                {#if splitPrice.suffix}
                  <span class="title-s text-foreground-placeholder"
                    >{splitPrice.suffix}</span
                  >
                {/if}
                {#if splitPrice.tail}
                  <span class="title-s text-foreground-placeholder"
                    >{splitPrice.tail}</span
                  >
                {/if}
              </div>
            {/if}

            <div class="mb-4 mt-6 flex min-h-8 items-start">
              {#if checkoutProductId && !isOwned && !isIncluded}
                <button
                  type="button"
                  disabled={isLoading || !canCheckout}
                  class={`${pricingCtaVariant === "filled" ? "button-filled" : "button-faded"} w-full disabled:cursor-not-allowed disabled:opacity-60`}
                  onclick={(event) =>
                    handleCheckoutClick(event, checkoutProductId)}
                >
                  {item.type === "one-time" && activeOwnedProductId ? i18n.labels.product.upgrade : i18n.labels.product.buyNow}
                </button>
              {:else if !isOwned && !isIncluded}
                <button
                  type="button"
                  disabled={isLoading || !canCheckout}
                  class={`${pricingCtaVariant === "filled" ? "button-filled" : "button-faded"} w-full disabled:cursor-not-allowed disabled:opacity-60`}
                  onclick={(event) =>
                    handleCheckoutClick(event, item.productId)}
                >
                  {i18n.labels.product.buyNow}
                </button>
              {/if}
            </div>

            {#if descriptionHtml}
              <div class="creem-prose w-full pt-4 body-m text-foreground-default">
                <!-- eslint-disable-next-line svelte/no-at-html-tags — merchant-authored markdown from Creem -->
                {@html descriptionHtml}
              </div>
            {/if}
          </div>
        {:else}
          <h3 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {resolvedTitle}
          </h3>

          {#if resolvedPrice}
            <p
              class={`mt-2 text-2xl font-bold ${isIncluded ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-900 dark:text-zinc-100"}`}
            >
              {resolvedPrice}
            </p>
          {/if}

          <div class="mt-4">
            {#if isOwned}
              <span
                class="inline-flex rounded-md bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-700"
              >
                {i18n.labels.product.owned}
              </span>
            {:else if isIncluded}
              <span
                class="inline-flex rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              >
                {i18n.labels.product.included}
              </span>
            {:else if checkoutProductId}
              <button
                type="button"
                disabled={isLoading || !canCheckout}
                class="button-filled disabled:cursor-not-allowed disabled:opacity-60"
                onclick={(event) =>
                  handleCheckoutClick(event, checkoutProductId)}
              >
                {item.type === "one-time" && activeOwnedProductId ? i18n.labels.product.upgrade : i18n.labels.product.buyNow}
              </button>
            {:else}
              <button
                type="button"
                disabled={isLoading || !canCheckout}
                class="button-filled disabled:cursor-not-allowed disabled:opacity-60"
                onclick={(event) =>
                  handleCheckoutClick(event, item.productId)}
              >
                {i18n.labels.product.buyNow}
              </button>
            {/if}
          </div>

          {#if resolvedDescription}
            <div
              class="creem-prose mt-4 text-sm text-zinc-600 dark:text-zinc-300"
            >
              <!-- eslint-disable-next-line svelte/no-at-html-tags — merchant-authored markdown from Creem -->
              {@html renderMarkdown(resolvedDescription)}
            </div>
          {/if}
        {/if}
      </article>
    {/each}
  </div>
</section>
