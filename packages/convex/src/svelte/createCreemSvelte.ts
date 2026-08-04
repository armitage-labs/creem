import { createCreemBinding } from "../core/binding.js";
import type { PlanCatalog } from "../core/types.js";
import type {
  CreateCreemBindingOptions,
  CreemBinding,
} from "../core/binding.js";

/** Options for {@link createCreemSvelte}. */
export type CreateCreemSvelteOptions<
  TCatalog extends PlanCatalog = PlanCatalog,
> = CreateCreemBindingOptions<TCatalog>;

/** Typed binding returned by {@link createCreemSvelte}. */
export type CreemSvelteBinding<TCatalog extends PlanCatalog = PlanCatalog> =
  CreemBinding<TCatalog>;

/**
 * Create a typed billing binding for Svelte.
 *
 * Binds a static plan catalog to your connected API so plan IDs are checked and
 * auto-completed. Spread the result onto `<CreemConvexProvider>`.
 *
 * The implementation is framework-agnostic and shared with React's
 * `createCreemReact`.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { createCreemSvelte, CreemConvexProvider, Subscription } from "@creem_io/convex/svelte";
 *
 *   const billing = createCreemSvelte({ catalog: billingCatalog, api: billingApi });
 * </script>
 *
 * <CreemConvexProvider {...billing}>
 *   <Subscription.Root plans={billing.planIds} />
 * </CreemConvexProvider>
 * ```
 */
export const createCreemSvelte = createCreemBinding;
