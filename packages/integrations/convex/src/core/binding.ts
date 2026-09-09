import type { PlanCatalog, PlanId, RecurringCycle } from "./types.js";
import type { ConnectedBillingApi } from "./connectedApi.js";

/**
 * Options for {@link createCreemBinding}.
 *
 * @template TCatalog - Static plan catalog type for plan ID auto-completion.
 */
export type CreateCreemBindingOptions<
  TCatalog extends PlanCatalog = PlanCatalog,
> = {
  /** Static plan catalog — enables typed plan IDs throughout the binding. */
  catalog: TCatalog;
  /** Convex function references for connected widgets. */
  api: ConnectedBillingApi;
  /** Default billing cycle for new subscriptions. */
  defaultCycle?: RecurringCycle;
};

/**
 * Typed catalog binding returned by {@link createCreemBinding}.
 *
 * @template TCatalog - Static plan catalog type.
 */
export type CreemBinding<TCatalog extends PlanCatalog = PlanCatalog> = {
  /** The plan catalog, passed through for widget consumption. */
  catalog: TCatalog;
  /** Connected Convex function references, passed through to the provider. */
  api: ConnectedBillingApi;
  /** Default billing cycle. */
  defaultCycle: RecurringCycle;
  /** All plan IDs from the catalog (typed). */
  planIds: PlanId<TCatalog>[];
  /** Narrowing guard for catalog plan IDs. */
  isPlanId: (id: string) => id is PlanId<TCatalog>;
};

/**
 * Bind a static plan catalog to a connected API so plan IDs are type-checked.
 *
 * The binding is framework-agnostic — React and Svelte re-export it as
 * `createCreemReact` / `createCreemSvelte`. Spread it onto
 * `<CreemConvexProvider>`; consent gates, permissions, and i18n are provider
 * props rather than binding options, so there is one place to configure them.
 *
 * @example
 * ```ts
 * const billing = createCreemReact({ catalog: billingCatalog, api: billingApi });
 *
 * <CreemConvexProvider {...billing}>
 *   <Subscription.Root plans={billing.planIds} />
 * </CreemConvexProvider>
 * ```
 */
export const createCreemBinding = <TCatalog extends PlanCatalog>(
  options: CreateCreemBindingOptions<TCatalog>,
): CreemBinding<TCatalog> => {
  const planIds = options.catalog.plans.map(
    (plan) => plan.planId,
  ) as PlanId<TCatalog>[];
  const planIdSet = new Set<string>(planIds);

  return {
    catalog: options.catalog,
    api: options.api,
    defaultCycle: options.defaultCycle ?? "every-month",
    planIds,
    isPlanId: (id: string): id is PlanId<TCatalog> => planIdSet.has(id),
  };
};
