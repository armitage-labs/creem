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
  Root: typeof SubscriptionRootComponent;
  Item: typeof SubscriptionItemComponent;
  Grid: typeof SubscriptionGridComponent;
  Group: typeof SubscriptionGroupComponent;
  GroupSelector: typeof SubscriptionGroupSelectorComponent;
  IntervalSelector: typeof SubscriptionIntervalSelectorComponent;
  ItemTitle: typeof SubscriptionItemTitleComponent;
  ItemPrice: typeof SubscriptionItemPriceComponent;
  ItemPriceCaption: typeof SubscriptionItemPriceCaptionComponent;
  ItemDescription: typeof SubscriptionItemDescriptionComponent;
  ItemCTA: typeof SubscriptionItemCTAComponent;
  ItemBadge: typeof SubscriptionItemBadgeComponent;
  UnitPicker: typeof SubscriptionUnitPickerComponent;
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
  Root: typeof ProductRootComponent;
  Item: typeof ProductItemComponent;
} = {
  Root: ProductRootComponent,
  Item: ProductItemComponent,
};

/** Compound customer-credits namespace. */
export const Credits: {
  Root: typeof CreditsRootComponent;
  Title: typeof CreditsTitleComponent;
  Amount: typeof CreditsAmountComponent;
  Refresh: typeof CreditsRefreshComponent;
  Error: typeof CreditsErrorComponent;
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
