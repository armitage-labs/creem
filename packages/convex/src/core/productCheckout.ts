export type ProductPurchaseType = "one-time" | "recurring";

export type ProductItemLike = {
  productId: string;
  type: ProductPurchaseType;
};

export type ProductTransitionLike =
  | { from: string; to: string; kind: "direct" }
  | { from: string; to: string; kind: "via_product"; viaProductId: string };

export const getEffectiveOwnedProductIds = (
  ownedProductIds: readonly string[],
  transitions: readonly ProductTransitionLike[],
) => {
  const effective = new Set(ownedProductIds);
  for (const rule of transitions) {
    if (rule.kind === "via_product" && effective.has(rule.viaProductId)) {
      effective.add(rule.to);
      effective.delete(rule.from);
    }
  }
  return [...effective];
};

export const isOwnedProduct = (
  item: ProductItemLike,
  effectiveOwnedProductIds: readonly string[],
) =>
  item.type === "one-time" && effectiveOwnedProductIds.includes(item.productId);

export const getActiveOwnedProductId = (
  items: readonly ProductItemLike[],
  effectiveOwnedProductIds: readonly string[],
) =>
  items.find((item) => isOwnedProduct(item, effectiveOwnedProductIds))
    ?.productId ?? null;

export const resolveProductCheckoutProductId = (
  item: ProductItemLike,
  activeOwnedProductId: string | null,
  transitions: readonly ProductTransitionLike[],
) => {
  if (item.type === "recurring" || !activeOwnedProductId) {
    return item.productId;
  }
  if (activeOwnedProductId === item.productId) {
    return null;
  }
  const rule = transitions.find(
    (candidate) =>
      candidate.from === activeOwnedProductId &&
      candidate.to === item.productId,
  );
  if (!rule) {
    return null;
  }
  if (rule.kind === "via_product") {
    return rule.viaProductId;
  }
  return item.productId;
};

/**
 * Whether a stored checkout intent should be dropped instead of resumed.
 *
 * Requires the registered items, not just `effectiveOwnedProductIds`: a
 * repeatable product (a credits pack, say) appears in the owned list yet must
 * stay purchasable, and only the item's `type` distinguishes it from a one-time
 * purchase. That means suppression depends on child `Product.Item` components
 * having registered. They register from their own effects, which React commits
 * before the parent's, so by the time the billing model resolves the list is
 * populated — but an intent could still slip through in the rare case where the
 * model resolves in the very same commit that mounts the items.
 */
export const shouldSuppressPendingCheckout = (
  pendingProductId: string,
  items: readonly ProductItemLike[],
  effectiveOwnedProductIds: readonly string[],
) =>
  items.some(
    (item) =>
      item.productId === pendingProductId &&
      isOwnedProduct(item, effectiveOwnedProductIds),
  );
