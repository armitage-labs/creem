import { createCreemBinding } from "../core/binding.js";
import type { PlanCatalog } from "../core/types.js";
import type {
  CreateCreemBindingOptions,
  CreemBinding,
} from "../core/binding.js";

/** Options for {@link createCreemReact}. */
export type CreateCreemReactOptions<
  TCatalog extends PlanCatalog = PlanCatalog,
> = CreateCreemBindingOptions<TCatalog>;

/** Typed binding returned by {@link createCreemReact}. */
export type CreemReactBinding<TCatalog extends PlanCatalog = PlanCatalog> =
  CreemBinding<TCatalog>;

/**
 * Create a typed billing binding for React.
 *
 * Binds a static plan catalog to your connected API so plan IDs are checked and
 * auto-completed. Spread the result onto `<CreemConvexProvider>`.
 *
 * The implementation is framework-agnostic and shared with Svelte's
 * `createCreemSvelte`.
 *
 * @example
 * ```tsx
 * import { createCreemReact, CreemConvexProvider, Subscription } from "@creem_io/convex/react";
 *
 * const billing = createCreemReact({ catalog: billingCatalog, api: billingApi });
 *
 * <CreemConvexProvider {...billing}>
 *   <Subscription.Root plans={billing.planIds} />
 * </CreemConvexProvider>
 * ```
 */
export const createCreemReact = createCreemBinding;
