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
import { formatPriceWithInterval, splitPriceLabel } from "../shared.js";
import { ProductGroupContext } from "./productGroupContext.js";
import { renderMarkdown } from "../../core/markdown.js";
import { pendingCheckout } from "../../core/pendingCheckout.js";

import type {
  BillingPermissions,
  CheckoutIntent,
  ConnectedBillingApi,
  ConnectedBillingModel,
  ProductItemRegistration,
  Transition,
} from "./types.js";

export const ProductRoot = ({
  api,
  permissions,
  transition = [],
  className = "",
  layout = "default",
  styleVariant = "legacy",
  showImages = false,
  pricingCtaVariant = "faded",
  successUrl,
  onBeforeCheckout,
  children,
}: PropsWithChildren<{
  api: ConnectedBillingApi;
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
  const client = useConvex();

  const billingUiModelRef = api.uiModel;
  const checkoutLinkRef = api.checkouts.create;

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
    !model?.user && onBeforeCheckout != null
      ? true
      : permissions?.canCheckout !== false;
  const allProducts = useMemo(
    () => model?.allProducts ?? [],
    [model?.allProducts],
  );
  const rawOwnedProductIds = useMemo(
    () => model?.ownedProductIds ?? [],
    [model?.ownedProductIds],
  );

  // Pending checkout resume after auth
  const pendingCheckoutHandled = useRef(false);
  useEffect(() => {
    if (!model?.user || pendingCheckoutHandled.current) return;
    pendingCheckoutHandled.current = true;
    const pending = pendingCheckout.load();
    if (!pending) return;
    if ((model.ownedProductIds ?? []).includes(pending.productId)) {
      pendingCheckout.clear();
      return;
    }
    startCheckout(pending.productId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.user]);

  // Resolve effective ownership by applying transition rules
  const effectiveOwnedProductIds = useMemo(() => {
    const effective = new Set(rawOwnedProductIds);
    for (const rule of transition) {
      if (rule.kind === "via_product" && effective.has(rule.viaProductId)) {
        effective.add(rule.to);
        effective.delete(rule.from);
      }
    }
    return [...effective];
  }, [rawOwnedProductIds, transition]);

  const activeOwnedProductId =
    registeredItems.find((item) =>
      effectiveOwnedProductIds.includes(item.productId),
    )?.productId ?? null;

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

  const resolveCheckoutProductId = useCallback(
    (toProductId: string) => {
      if (!activeOwnedProductId) {
        return toProductId;
      }
      const rule = transition.find(
        (r) => r.from === activeOwnedProductId && r.to === toProductId,
      );
      if (!rule) {
        return null;
      }
      if (rule.kind === "via_product") {
        return rule.viaProductId;
      }
      return toProductId;
    },
    [activeOwnedProductId, transition],
  );

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

  const startCheckout = useCallback(
    async (checkoutProductId: string) => {
      if (onBeforeCheckout) {
        const proceed = await onBeforeCheckout({
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
          checkoutError instanceof Error
            ? checkoutError.message
            : "Checkout failed",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [client, checkoutLinkRef, successUrl, onBeforeCheckout],
  );

  return (
    <ProductGroupContext.Provider value={contextValue}>
      <div className="hidden" aria-hidden="true">
        {children}
      </div>

      <section
        className={`${styleVariant === "pricing" ? "space-y-0" : "space-y-3"} ${className}`}
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
            const isOwned = effectiveOwnedProductIds.includes(item.productId);
            const isIncluded =
              !isOwned &&
              activeOwnedProductId != null &&
              isLowerTierThan(item.productId, activeOwnedProductId);
            const checkoutProductId = resolveCheckoutProductId(item.productId);
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
                        <span className="badge-faded-sm">Owned</span>
                      ) : isIncluded ? (
                        <span className="badge-faded-sm">Included</span>
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
                          className={`${pricingCtaVariant === "filled" ? "button-filled" : "button-faded"} w-full`}
                        >
                          {activeOwnedProductId ? "Upgrade" : "Buy now"}
                        </CheckoutButton>
                      ) : !isOwned && !isIncluded ? (
                        <CheckoutButton
                          productId={item.productId}
                          disabled={isLoading || !canCheckout}
                          onCheckout={() => startCheckout(item.productId)}
                          className={`${pricingCtaVariant === "filled" ? "button-filled" : "button-faded"} w-full`}
                        >
                          Buy now
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
                      Owned
                    </span>
                  ) : isIncluded ? (
                    <span className="inline-flex rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      Included
                    </span>
                  ) : checkoutProductId ? (
                    <CheckoutButton
                      productId={checkoutProductId}
                      disabled={isLoading || !canCheckout}
                      onCheckout={() => startCheckout(checkoutProductId)}
                    >
                      {activeOwnedProductId ? "Upgrade" : "Buy now"}
                    </CheckoutButton>
                  ) : (
                    <CheckoutButton
                      productId={item.productId}
                      disabled={isLoading || !canCheckout}
                      onCheckout={() => startCheckout(item.productId)}
                    >
                      Buy now
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
