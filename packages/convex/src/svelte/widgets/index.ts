import SubscriptionItemComponent from "./Subscription.svelte";
import SubscriptionRootComponent from "./SubscriptionRoot.svelte";
import ProductItemComponent from "./Product.svelte";
import ProductRootComponent from "./ProductRoot.svelte";

export { default as BillingPortal } from "./BillingPortal.svelte";

export const Subscription: typeof SubscriptionItemComponent & {
  Root: typeof SubscriptionRootComponent;
  Item: typeof SubscriptionItemComponent;
  /** @deprecated Use `Subscription.Root` instead. */
  Group: typeof SubscriptionRootComponent;
} = Object.assign(SubscriptionItemComponent, {
  Root: SubscriptionRootComponent,
  Item: SubscriptionItemComponent,
  Group: SubscriptionRootComponent,
});

export const Product: typeof ProductItemComponent & {
  Root: typeof ProductRootComponent;
  Item: typeof ProductItemComponent;
  /** @deprecated Use `Product.Root` instead. */
  Group: typeof ProductRootComponent;
} = Object.assign(ProductItemComponent, {
  Root: ProductRootComponent,
  Item: ProductItemComponent,
  Group: ProductRootComponent,
});

export type {
  ConnectedBillingApi,
  ConnectedBillingModel,
  ProductType,
  SubscriptionPlanType,
  Transition,
} from "./types.js";
