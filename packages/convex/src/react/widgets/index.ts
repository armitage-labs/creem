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
  /**
   * Owns billing state and actions for the plans registered inside it:
   * billing-cycle toggle, checkout, plan switching, cancellation, and units.
   *
   * Renders the default pricing cards when given no children.
   */
  Root: SubscriptionRoot,
  /**
   * Registers a plan inside `Subscription.Root`.
   *
   * Without children it only registers, and the root renders the default card.
   * With children it becomes the card wrapper and supplies the context every
   * `Subscription.Item*` slot reads.
   */
  Item: SubscriptionItem,
  /**
   * Layout wrapper for custom composed cards.
   *
   * Reads the root's `columns` prop, so a composed layout resolves its column
   * count the same way the default cards do.
   */
  Grid: SubscriptionGrid,
  /**
   * Renders its children only while the matching audience group is active.
   *
   * Pair with `groupSelector="external"`.
   */
  Group: SubscriptionGroup,
  /**
   * Audience group selector (for example Individual vs Teams) for
   * `groupSelector="external"` composition.
   */
  GroupSelector: SubscriptionGroupSelector,
  /**
   * Billing-cycle selector for `intervalSelector="external"` composition.
   *
   * Wired to the root's cycle state.
   */
  IntervalSelector: SubscriptionIntervalSelector,
  /**
   * Plan title, resolved from the catalog entry or the synced Creem product.
   */
  ItemTitle: SubscriptionItemTitle,
  /**
   * Plan price for the active billing cycle, formatted with the provider's
   * currency formatter.
   */
  ItemPrice: SubscriptionItemPrice,
  /**
   * Secondary price line for inherited unit quantities, such as `$30/mo × 3
   * units`.
   *
   * Pair with `Subscription.ItemPrice` when the card shows the total as the
   * primary price.
   */
  ItemPriceCaption: SubscriptionItemPriceCaption,
  /**
   * Plan description, rendered as Markdown.
   */
  ItemDescription: SubscriptionItemDescription,
  /**
   * The plan's action button.
   *
   * Resolves to checkout, plan switch, or the current-plan state on its own.
   */
  ItemCTA: SubscriptionItemCTA,
  /**
   * Current-plan, recommended, or scheduled-plan badge for the card.
   */
  ItemBadge: SubscriptionItemBadge,
  /**
   * Quantity control for unit-based plans.
   *
   * Sets the checkout quantity on inactive cards and drives the change/update
   * flow on the active one. Renders nothing on switch-plan cards.
   */
  UnitPicker: SubscriptionUnitPicker,
  /**
   * Cancel button for the active subscription card.
   *
   * Opens the same root-owned confirmation dialog as the default card, and
   * renders nothing when the card is not active or cancellation is unavailable.
   */
  Cancel: SubscriptionCancel,
} as const;

/** Compound one-time product namespace. */
export const Product = {
  /**
   * Owns ownership tracking, upgrade transitions, and checkout for the
   * one-time and repeating products registered inside it.
   */
  Root: ProductRoot,
  /**
   * Registers a one-time or repeating product inside `Product.Root`.
   */
  Item: ProductItem,
} as const;

/** Compound customer-credits namespace. */
export const Credits = {
  /**
   * Loads the customer's credit balance through the provider's
   * `credits.getBalance` action and exposes it to the slots inside it.
   */
  Root: CreditsRoot,
  /**
   * Heading for the credit balance card.
   */
  Title: CreditsTitle,
  /**
   * The numeric credit balance with its unit label.
   */
  Amount: CreditsAmount,
  /**
   * Icon button that re-reads the balance.
   *
   * Call it after an app action that spends credits.
   */
  Refresh: CreditsRefresh,
  /**
   * Renders the last credit API error, or nothing when there is none.
   */
  Error: CreditsError,
  /**
   * Loading or idle status text for the balance.
   */
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
