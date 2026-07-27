import { SubscriptionItem } from "./SubscriptionItem.js";
import { SubscriptionRoot } from "./SubscriptionRoot.js";
import { SubscriptionGrid } from "./SubscriptionGrid.js";
import { SubscriptionGroup } from "./SubscriptionGroup.js";
import { SubscriptionGroupSelector } from "./SubscriptionGroupSelector.js";
import { SubscriptionIntervalSelector } from "./SubscriptionIntervalSelector.js";
import {
  SubscriptionItemTitle,
  SubscriptionItemPrice,
  SubscriptionItemPriceCaption,
  SubscriptionItemDescription,
  SubscriptionItemCTA,
  SubscriptionItemBadge,
  SubscriptionUnitPicker,
  SubscriptionCancel,
} from "./SubscriptionItemSlots.js";
import { ProductItem } from "./ProductItem.js";
import { ProductRoot } from "./ProductRoot.js";
import { CreditsRoot } from "./CreditsRoot.js";
import {
  CreditsAmount,
  CreditsError,
  CreditsRefresh,
  CreditsStatus,
  CreditsTitle,
} from "./CreditsSlots.js";

export { BillingPortal } from "./BillingPortal.js";
export { BillingHistory } from "./BillingHistory.js";
export { useSubscriptionItem } from "./subscriptionItemContext.js";
export { useCredits } from "./creditsContext.js";

/**
 * Compound subscription namespace.
 *
 * A plain namespace object, not a callable component: `<Subscription.Root>` and
 * `<Subscription.Item>` do different things, so rendering a bare
 * `<Subscription>` is a type error rather than a silently empty card.
 */
export const Subscription = {
  Root: SubscriptionRoot,
  Item: SubscriptionItem,
  Grid: SubscriptionGrid,
  Group: SubscriptionGroup,
  GroupSelector: SubscriptionGroupSelector,
  IntervalSelector: SubscriptionIntervalSelector,
  ItemTitle: SubscriptionItemTitle,
  ItemPrice: SubscriptionItemPrice,
  ItemPriceCaption: SubscriptionItemPriceCaption,
  ItemDescription: SubscriptionItemDescription,
  ItemCTA: SubscriptionItemCTA,
  ItemBadge: SubscriptionItemBadge,
  UnitPicker: SubscriptionUnitPicker,
  Cancel: SubscriptionCancel,
} as const;

/** Compound one-time product namespace. */
export const Product = {
  Root: ProductRoot,
  Item: ProductItem,
} as const;

/** Compound customer-credits namespace. */
export const Credits = {
  Root: CreditsRoot,
  Title: CreditsTitle,
  Amount: CreditsAmount,
  Refresh: CreditsRefresh,
  Error: CreditsError,
  Status: CreditsStatus,
} as const;

export type {
  ConnectedBillingApi,
  ConnectedBillingModel,
  ConnectedTransaction,
  ConnectedTransactionList,
  ProductType,
  SubscriptionPlanType,
  Transition,
} from "./types.js";
