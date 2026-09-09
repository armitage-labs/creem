import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type PropsWithChildren,
} from "react";
import { useQuery, useConvex } from "convex/react";

import { CheckoutButton } from "../primitives/CheckoutButton.js";
import {
  formatPriceWithInterval,
  splitPriceLabel,
} from "../../core/display.js";
import { ProductGroupContext } from "./productGroupContext.js";
import { renderMarkdown } from "../../core/markdown.js";
import { pendingCheckout } from "../../core/pendingCheckout.js";
import { resolveBillingI18n } from "../../core/i18n.js";
import { getConvexErrorMessage } from "../../core/convexError.js";
import {
  getActiveOwnedProductId,
  getEffectiveOwnedProductIds,
  isOwnedProduct,
  resolveProductCheckoutProductId,
  shouldSuppressPendingCheckout,
} from "../../core/productCheckout.js";
import {
  requireCreemConvexApi,
  useCreemConvex,
} from "../CreemConvexProvider.js";

import type {
  BillingPermissions,
  CheckoutIntent,
  ConnectedBillingModel,
  ProductItemRegistration,
  Transition,
} from "./types.js";

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

export const ProductRoot = ({
  permissions,
  transition = [],
  className,
  class: classProp,
  layout = "default",
  styleVariant = "legacy",
  showImages = false,
  pricingCtaVariant = "faded",
  successUrl,
  onBeforeCheckout,
  children,
}: PropsWithChildren<{
  permissions?: BillingPermissions;
  transition?: Transition[];
  class?: string;
  className?: string;
  layout?: "default" | "single";
  styleVariant?: "legacy" | "pricing";
  showImages?: boolean;
  pricingCtaVariant?: "filled" | "faded";
  successUrl?: string;
  onBeforeCheckout?: (intent: CheckoutIntent) => Promise<boolean> | boolean;
}>) => {
  const provider = useCreemConvex();
  const resolvedApi = requireCreemConvexApi("Product.Root", provider);
  const resolvedPermissions = permissions ?? provider?.permissions;
  const resolvedOnBeforeCheckout =
    onBeforeCheckout ?? provider?.onBeforeCheckout;
  const i18n = useMemo(
    () => resolveBillingI18n(provider?.i18n),
    [provider?.i18n],
  );

  const client = useConvex();

  const billingUiModelRef = resolvedApi.uiModel;
  const checkoutLinkRef = resolvedApi.checkouts.create;

  const modelRaw = useQuery(billingUiModelRef, {});
  const model = (modelRaw ?? null) as ConnectedBillingModel | null;

  const [registeredItems, setRegisteredItems] = useState<
    ProductItemRegistration[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contextValue = useMemo(
    () => ({
      registerItem: (item: ProductItemRegistration) => {
        setRegisteredItems((prev) => [
          ...prev.filter((c) => c.productId !== item.productId),
          item,
        ]);
        return () => {
          setRegisteredItems((prev) =>
            prev.filter((c) => c.productId !== item.productId),
          );
        };
      },
    }),
    [],
  );

  const canCheckout =
    !model?.user && resolvedOnBeforeCheckout != null
      ? true
      : resolvedPermissions?.canCheckout !== false;
  const allProducts = useMemo(
    () => model?.allProducts ?? [],
    [model?.allProducts],
  );
  const rawOwnedProductIds = useMemo(
    () => model?.ownedProductIds ?? [],
    [model?.ownedProductIds],
  );

  // Resolve effective ownership by applying transition rules
  const effectiveOwnedProductIds = useMemo(
    () => getEffectiveOwnedProductIds(rawOwnedProductIds, transition),
    [rawOwnedProductIds, transition],
  );

  const activeOwnedProductId = getActiveOwnedProductId(
    registeredItems,
    effectiveOwnedProductIds,
  );

  const startCheckout = useCallback(
    async (checkoutProductId: string) => {
      if (resolvedOnBeforeCheckout) {
        const proceed = await resolvedOnBeforeCheckout({
          productId: checkoutProductId,
        });
        if (!proceed) return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const { url } = await client.action(checkoutLinkRef, {
          productId: checkoutProductId,
          ...(successUrl ? { successUrl } : {}),
          fallbackSuccessUrl: getFallbackSuccessUrl(),
          theme: getPreferredTheme(),
        });
        window.addEventListener(
          "beforeunload",
          (e) => {
            e.stopImmediatePropagation();
          },
          { capture: true, once: true },
        );
        window.location.href = url;
      } catch (checkoutError) {
        setError(
          getConvexErrorMessage(
            checkoutError,
            i18n.labels.product.checkoutFailed,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      client,
      checkoutLinkRef,
      successUrl,
      resolvedOnBeforeCheckout,
      i18n.labels.product.checkoutFailed,
    ],
  );

  // Pending checkout resume after auth.
  // Reads without consuming and clears only once the checkout is actually
  // started: under StrictMode the effect runs twice, and a consuming read on the
  // first run would throw the intent away before anything could resume it.
  const pendingCheckoutHandled = useRef(false);
  useEffect(() => {
    if (!model?.user || pendingCheckoutHandled.current) return;
    const pending = pendingCheckout.peek();
    if (!pending) return;
    pendingCheckoutHandled.current = true;
    pendingCheckout.clear();
    if (
      shouldSuppressPendingCheckout(
        pending.productId,
        registeredItems,
        effectiveOwnedProductIds,
      )
    ) {
      return;
    }
    // Deferred so the effect body does not update state synchronously, and
    // deliberately NOT cleared on cleanup: StrictMode's simulated unmount would
    // cancel the resume, and the ref guard above already prevents a duplicate.
    setTimeout(() => {
      void startCheckout(pending.productId);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.user]);

  const isLowerTierThan = useCallback(
    (productId: string, targetId: string): boolean => {
      const visited = new Set<string>();
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
    },
    [transition],
  );

  return (
    <ProductGroupContext.Provider value={contextValue}>
      <div className="hidden" aria-hidden="true">
        {children}
      </div>

      <section
        className={`${styleVariant === "pricing" ? "space-y-0" : "space-y-3"} ${className ?? classProp ?? ""}`}
      >
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div
          className={
            styleVariant === "pricing"
              ? layout === "single"
                ? "flex justify-center"
                : "grid grid-cols-1 gap-1 lg:grid-cols-2"
              : `flex gap-3 ${layout === "single" ? "justify-center" : "flex-wrap items-center"}`
          }
        >
          {registeredItems.map((item) => {
            const isOwned = isOwnedProduct(item, effectiveOwnedProductIds);
            const isIncluded =
              !isOwned &&
              activeOwnedProductId != null &&
              isLowerTierThan(item.productId, activeOwnedProductId);
            const checkoutProductId = resolveProductCheckoutProductId(
              item,
              activeOwnedProductId,
              transition,
            );
            const matchedProduct = allProducts.find(
              (p) => p.id === item.productId,
            );
            const resolvedTitle =
              item.title ?? matchedProduct?.name ?? item.productId;
            const resolvedDescription =
              item.description ?? matchedProduct?.description;
            const resolvedImageUrl = matchedProduct?.imageUrl;
            const resolvedPrice = formatPriceWithInterval(
              item.productId,
              allProducts,
              i18n.labels,
              i18n.formatCurrency,
            );
            const splitPrice = splitPriceLabel(resolvedPrice);
            const descriptionHtml = renderMarkdown(resolvedDescription);

            if (styleVariant === "pricing") {
              return (
                <article
                  key={item.productId}
                  className={`w-full ${layout === "single" ? "max-w-[680px]" : "max-w-none"} rounded-2xl bg-surface-base ${isIncluded ? "opacity-60" : ""}`}
                >
                  {showImages && resolvedImageUrl && (
                    <div className="p-1">
                      <img
                        src={resolvedImageUrl}
                        alt={resolvedTitle}
                        className="aspect-[16/9] w-full rounded-xl object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div className="px-6 pb-6 pt-6">
                    <div className="mb-3 flex min-h-6 items-center justify-between gap-2">
                      <h3 className="title-s text-foreground-default">
                        {resolvedTitle}
                      </h3>
                      {isOwned ? (
                        <span className="badge-faded-sm">
                          {i18n.labels.product.owned}
                        </span>
                      ) : isIncluded ? (
                        <span className="badge-faded-sm">
                          {i18n.labels.product.included}
                        </span>
                      ) : null}
                    </div>

                    {splitPrice && (
                      <div className="flex items-baseline gap-1">
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
                      </div>
                    )}

                    <div className="mb-4 mt-6 flex min-h-8 items-start">
                      {checkoutProductId && !isOwned && !isIncluded ? (
                        <CheckoutButton
                          productId={checkoutProductId}
                          disabled={isLoading || !canCheckout}
                          onCheckout={() => startCheckout(checkoutProductId)}
                          labels={i18n.labels}
                          className={`${pricingCtaVariant === "filled" ? "button-filled" : "button-faded"} w-full`}
                        >
                          {item.type === "one-time" && activeOwnedProductId
                            ? i18n.labels.product.upgrade
                            : i18n.labels.product.buyNow}
                        </CheckoutButton>
                      ) : !isOwned && !isIncluded ? (
                        <CheckoutButton
                          productId={item.productId}
                          disabled={isLoading || !canCheckout}
                          onCheckout={() => startCheckout(item.productId)}
                          labels={i18n.labels}
                          className={`${pricingCtaVariant === "filled" ? "button-filled" : "button-faded"} w-full`}
                        >
                          {i18n.labels.product.buyNow}
                        </CheckoutButton>
                      ) : null}
                    </div>

                    {descriptionHtml && (
                      <div
                        className="creem-prose w-full pt-4 body-m text-foreground-default"
                        dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                      />
                    )}
                  </div>
                </article>
              );
            }

            // Legacy style variant
            return (
              <article
                key={item.productId}
                className={`max-w-sm rounded-xl border p-4 shadow-sm ${
                  isIncluded
                    ? "border-zinc-100 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
                    : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
                }`}
              >
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {resolvedTitle}
                </h3>

                {resolvedPrice && (
                  <p
                    className={`mt-2 text-2xl font-bold ${
                      isIncluded
                        ? "text-zinc-400 dark:text-zinc-500"
                        : "text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {resolvedPrice}
                  </p>
                )}

                <div className="mt-4">
                  {isOwned ? (
                    <span className="inline-flex rounded-md bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-700">
                      {i18n.labels.product.owned}
                    </span>
                  ) : isIncluded ? (
                    <span className="inline-flex rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {i18n.labels.product.included}
                    </span>
                  ) : checkoutProductId ? (
                    <CheckoutButton
                      productId={checkoutProductId}
                      disabled={isLoading || !canCheckout}
                      onCheckout={() => startCheckout(checkoutProductId)}
                      labels={i18n.labels}
                    >
                      {item.type === "one-time" && activeOwnedProductId
                        ? i18n.labels.product.upgrade
                        : i18n.labels.product.buyNow}
                    </CheckoutButton>
                  ) : (
                    <CheckoutButton
                      productId={item.productId}
                      disabled={isLoading || !canCheckout}
                      onCheckout={() => startCheckout(item.productId)}
                      labels={i18n.labels}
                    >
                      {i18n.labels.product.buyNow}
                    </CheckoutButton>
                  )}
                </div>

                {resolvedDescription && (
                  <div
                    className="creem-prose mt-4 text-sm text-zinc-600 dark:text-zinc-300"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(resolvedDescription),
                    }}
                  />
                )}
              </article>
            );
          })}
        </div>
      </section>
    </ProductGroupContext.Provider>
  );
};
