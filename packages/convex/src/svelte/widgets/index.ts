import SubscriptionItemComponent from "./Subscription.svelte";
import SubscriptionRootComponent from "./SubscriptionRoot.svelte";
import SubscriptionGridComponent from "./SubscriptionGrid.svelte";
import SubscriptionGroupComponent from "./SubscriptionGroup.svelte";
import SubscriptionGroupSelectorComponent from "./SubscriptionGroupSelector.svelte";
import SubscriptionIntervalSelectorComponent from "./SubscriptionIntervalSelector.svelte";
import SubscriptionItemTitleComponent from "./SubscriptionItemTitle.svelte";
import SubscriptionItemPriceComponent from "./SubscriptionItemPrice.svelte";
import SubscriptionItemPriceCaptionComponent from "./SubscriptionItemPriceCaption.svelte";
import SubscriptionItemDescriptionComponent from "./SubscriptionItemDescription.svelte";
import SubscriptionItemCTAComponent from "./SubscriptionItemCTA.svelte";
import SubscriptionItemBadgeComponent from "./SubscriptionItemBadge.svelte";
import SubscriptionUnitPickerComponent from "./SubscriptionUnitPicker.svelte";
import SubscriptionCancelComponent from "./SubscriptionCancel.svelte";
import ProductItemComponent from "./Product.svelte";
import ProductRootComponent from "./ProductRoot.svelte";
import CreditsRootComponent from "./Credits.svelte";
import CreditsTitleComponent from "./CreditsTitle.svelte";
import CreditsAmountComponent from "./CreditsAmount.svelte";
import CreditsRefreshComponent from "./CreditsRefresh.svelte";
import CreditsErrorComponent from "./CreditsError.svelte";
import CreditsStatusComponent from "./CreditsStatus.svelte";

export { default as BillingPortal } from "./BillingPortal.svelte";
export { default as BillingHistory } from "./BillingHistory.svelte";
export { getSubscriptionItemContext } from "./subscriptionItemContext.js";
export { getCreditsContext } from "./creditsContext.js";

/**
 * Compound subscription namespace.
 *
 * A plain namespace object, not a callable component: `<Subscription.Root>` and
 * `<Subscription.Item>` do different things, so rendering a bare
 * `<Subscription>` is a type error rather than a silently empty card.
 */
export const Subscription: {
  /**
   * Owns billing state and actions for the plans registered inside it:
   * billing-cycle toggle, checkout, plan switching, cancellation, and units.
   *
   * Renders the default pricing cards when given no children.
   */
  Root: typeof SubscriptionRootComponent;
  /**
   * Registers a plan inside `Subscription.Root`.
   *
   * Without children it only registers, and the root renders the default card.
   * With children it becomes the card wrapper and supplies the context every
   * `Subscription.Item*` slot reads.
   */
  Item: typeof SubscriptionItemComponent;
  /**
   * Layout wrapper for custom composed cards.
   *
   * Reads the root's `columns` prop, so a composed layout resolves its column
   * count the same way the default cards do.
   */
  Grid: typeof SubscriptionGridComponent;
  /**
   * Renders its children only while the matching audience group is active.
   *
   * Pair with `groupSelector="external"`.
   */
  Group: typeof SubscriptionGroupComponent;
  /**
   * Audience group selector (for example Individual vs Teams) for
   * `groupSelector="external"` composition.
   */
  GroupSelector: typeof SubscriptionGroupSelectorComponent;
  /**
   * Billing-cycle selector for `intervalSelector="external"` composition.
   *
   * Wired to the root's cycle state.
   */
  IntervalSelector: typeof SubscriptionIntervalSelectorComponent;
  /**
   * Plan title, resolved from the catalog entry or the synced Creem product.
   */
  ItemTitle: typeof SubscriptionItemTitleComponent;
  /**
   * Plan price for the active billing cycle, formatted with the provider's
   * currency formatter.
   */
  ItemPrice: typeof SubscriptionItemPriceComponent;
  /**
   * Secondary price line for inherited unit quantities, such as `$30/mo × 3
   * units`.
   *
   * Pair with `Subscription.ItemPrice` when the card shows the total as the
   * primary price.
   */
  ItemPriceCaption: typeof SubscriptionItemPriceCaptionComponent;
  /**
   * Plan description, rendered as Markdown.
   */
  ItemDescription: typeof SubscriptionItemDescriptionComponent;
  /**
   * The plan's action button.
   *
   * Resolves to checkout, plan switch, or the current-plan state on its own.
   */
  ItemCTA: typeof SubscriptionItemCTAComponent;
  /**
   * Current-plan, recommended, or scheduled-plan badge for the card.
   */
  ItemBadge: typeof SubscriptionItemBadgeComponent;
  /**
   * Quantity control for unit-based plans.
   *
   * Sets the checkout quantity on inactive cards and drives the change/update
   * flow on the active one. Renders nothing on switch-plan cards.
   */
  UnitPicker: typeof SubscriptionUnitPickerComponent;
  /**
   * Cancel button for the active subscription card.
   *
   * Opens the same root-owned confirmation dialog as the default card, and
   * renders nothing when the card is not active or cancellation is unavailable.
   */
  Cancel: typeof SubscriptionCancelComponent;
} = {
  Root: SubscriptionRootComponent,
  Item: SubscriptionItemComponent,
  Grid: SubscriptionGridComponent,
  Group: SubscriptionGroupComponent,
  GroupSelector: SubscriptionGroupSelectorComponent,
  IntervalSelector: SubscriptionIntervalSelectorComponent,
  ItemTitle: SubscriptionItemTitleComponent,
  ItemPrice: SubscriptionItemPriceComponent,
  ItemPriceCaption: SubscriptionItemPriceCaptionComponent,
  ItemDescription: SubscriptionItemDescriptionComponent,
  ItemCTA: SubscriptionItemCTAComponent,
  ItemBadge: SubscriptionItemBadgeComponent,
  UnitPicker: SubscriptionUnitPickerComponent,
  Cancel: SubscriptionCancelComponent,
};

/** Compound one-time product namespace. */
export const Product: {
  /**
   * Owns ownership tracking, upgrade transitions, and checkout for the
   * one-time and repeating products registered inside it.
   */
  Root: typeof ProductRootComponent;
  /**
   * Registers a one-time or repeating product inside `Product.Root`.
   */
  Item: typeof ProductItemComponent;
} = {
  Root: ProductRootComponent,
  Item: ProductItemComponent,
};

/** Compound customer-credits namespace. */
export const Credits: {
  /**
   * Loads the customer's credit balance through the provider's
   * `credits.getBalance` action and exposes it to the slots inside it.
   */
  Root: typeof CreditsRootComponent;
  /**
   * Heading for the credit balance card.
   */
  Title: typeof CreditsTitleComponent;
  /**
   * The numeric credit balance with its unit label.
   */
  Amount: typeof CreditsAmountComponent;
  /**
   * Icon button that re-reads the balance.
   *
   * Call it after an app action that spends credits.
   */
  Refresh: typeof CreditsRefreshComponent;
  /**
   * Renders the last credit API error, or nothing when there is none.
   */
  Error: typeof CreditsErrorComponent;
  /**
   * Loading or idle status text for the balance.
   */
  Status: typeof CreditsStatusComponent;
} = {
  Root: CreditsRootComponent,
  Title: CreditsTitleComponent,
  Amount: CreditsAmountComponent,
  Refresh: CreditsRefreshComponent,
  Error: CreditsErrorComponent,
  Status: CreditsStatusComponent,
};

export type { CreditsContextValue } from "./creditsContext.js";

export type {
  ConnectedBillingApi,
  ConnectedBillingModel,
  ConnectedTransaction,
  ConnectedTransactionList,
  ProductType,
  SubscriptionPlanType,
  Transition,
} from "./types.js";
