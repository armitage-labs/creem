/** Preferred pricing column count, as accepted by `<Subscription.Root columns>`. */
export type PricingColumns = "auto" | 1 | 2 | 3 | 4;

const COLUMN_CLASSES: Record<Exclude<PricingColumns, "auto">, string> = {
  1: "creem-base:grid-cols-1",
  2: "creem-base:grid-cols-1 sm:creem-base:grid-cols-2",
  3: "creem-base:grid-cols-1 sm:creem-base:grid-cols-2 lg:creem-base:grid-cols-3",
  4: "creem-base:grid-cols-1 sm:creem-base:grid-cols-2 lg:creem-base:grid-cols-4",
};

/**
 * Grid classes for `<Subscription.Grid>`.
 *
 * Shares the root's `columns` prop so a composed layout and the default pricing
 * cards resolve their column count the same way. `"auto"` keeps the responsive
 * 1 → 2 → 3 default.
 */
export const subscriptionGridClasses = (columns: PricingColumns): string =>
  `creem-base:grid creem-base:gap-4 ${
    columns === "auto" ? COLUMN_CLASSES[3] : COLUMN_CLASSES[columns]
  }`;
