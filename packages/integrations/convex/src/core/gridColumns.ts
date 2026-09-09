/** Preferred pricing column count, as accepted by `<Subscription.Root columns>`. */
export type PricingColumns = "auto" | 1 | 2 | 3 | 4;

// Breakpoints mirror `PricingSection` so a composed grid and the default cards
// break to the same number of columns at the same width. They previously
// diverged (lg vs md), so the same `columns` value produced two different
// layouts depending on whether the app composed its own grid.
const COLUMN_CLASSES: Record<Exclude<PricingColumns, "auto">, string> = {
  1: "creem-base:grid-cols-1",
  2: "creem-base:grid-cols-1 sm:creem-base:grid-cols-2",
  3: "creem-base:grid-cols-1 sm:creem-base:grid-cols-2 md:creem-base:grid-cols-3",
  4: "creem-base:grid-cols-1 sm:creem-base:grid-cols-2 md:creem-base:grid-cols-3 xl:creem-base:grid-cols-4",
};

/**
 * Grid classes for `<Subscription.Grid>`.
 *
 * Shares the root's `columns` prop so a composed layout and the default pricing
 * cards resolve their column count the same way.
 *
 * `"auto"` keeps the responsive 1 → 2 → 3 default. It cannot match
 * `PricingSection` exactly, which also narrows to two columns when a unit picker
 * is shown or there are two or fewer plans — a composed grid does not know
 * either. Pass an explicit `columns` when you need the layouts to agree
 * regardless of plan count.
 */
export const subscriptionGridClasses = (columns: PricingColumns): string =>
  `creem-base:grid creem-base:gap-4 ${
    columns === "auto" ? COLUMN_CLASSES[3] : COLUMN_CLASSES[columns]
  }`;
