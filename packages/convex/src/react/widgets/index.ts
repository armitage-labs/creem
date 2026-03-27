import { SubscriptionItem } from "./SubscriptionItem.js";
import { SubscriptionRoot } from "./SubscriptionRoot.js";
import { ProductItem } from "./ProductItem.js";
import { ProductRoot } from "./ProductRoot.js";

export { BillingPortal } from "./BillingPortal.js";

export const Subscription: typeof SubscriptionItem & {
  Root: typeof SubscriptionRoot;
  Item: typeof SubscriptionItem;
  /** @deprecated Use `Subscription.Root` instead. */
  Group: typeof SubscriptionRoot;
} = Object.assign(SubscriptionItem, {
  Root: SubscriptionRoot,
  Item: SubscriptionItem,
  Group: SubscriptionRoot,
});

export const Product: typeof ProductItem & {
  Root: typeof ProductRoot;
  Item: typeof ProductItem;
  /** @deprecated Use `Product.Root` instead. */
  Group: typeof ProductRoot;
} = Object.assign(ProductItem, {
  Root: ProductRoot,
  Item: ProductItem,
  Group: ProductRoot,
});

export type {
  ConnectedBillingApi,
  ConnectedBillingModel,
  ProductType,
  SubscriptionPlanType,
  Transition,
} from "./types.js";
