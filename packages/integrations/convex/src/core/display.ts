import type {
  AvailableAction,
  BillingSnapshot,
  RecurringCycle,
  SupportedRecurringCycle,
  UIPlanEntry,
} from "./types.js";
import {
  defaultBillingLabels,
  type BillingCurrencyFormatInput,
  type BillingLabels,
} from "./i18n.js";

/**
 * The subset of a synced product needed to format a price.
 */
export type PricedProduct = {
  id: string;
  price?: number;
  currency?: string;
  billingPeriod?: string;
};

/** Format a canonical recurring cycle value to a localized billing-cycle label. */
export const formatRecurringCycle = (
  cycle: RecurringCycle,
  labels: BillingLabels = defaultBillingLabels,
) => labels.billingCycle[cycle];

/**
 * Resolve the Creem product ID for a catalog plan and canonical selected cycle.
 *
 * Catalog product maps are expected to use Creem-compatible keys such as
 * `"every-month"`, `"every-year"`, or `"custom"`. Non-canonical aliases are
 * intentionally not supported so invalid catalog keys fail visibly.
 */
export const resolveProductIdForPlan = (
  plan: UIPlanEntry,
  selectedCycle: RecurringCycle | undefined,
) => {
  const productIds = plan.creemProductIds;
  if (!productIds) return undefined;

  const cycle = selectedCycle ?? "custom";
  // Deliberate tail fallback (pinned by tests): a plan that does not offer the
  // selected cycle still resolves to *some* product rather than rendering a
  // priceless, un-checkoutable card. The trade-off is that such a card shows the
  // other cycle's price and checks out into that product, so a catalog should
  // either offer every advertised cycle for a plan or scope the plan to a group
  // whose cycles it fully covers.
  return productIds[cycle] ?? Object.values(productIds)[0];
};

/** Local variant of `hasBillingAction` for shared UI code. */
export const hasBillingActionLocal = (
  snapshot: Pick<BillingSnapshot, "availableBillingActions">,
  action: AvailableAction,
) => snapshot.availableBillingActions.includes(action);

/** Format a minor-unit price amount such as cents into localized currency text. */
export const formatPrice = (
  amount: number,
  currency: string,
  formatCurrency?: (input: BillingCurrencyFormatInput) => string,
): string =>
  (
    formatCurrency ??
    ((input) =>
      new Intl.NumberFormat(input.locale, {
        style: "currency",
        currency: input.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(input.amount / 100))
  )({ amount, currency });

/** Resolve a product's formatted price and raw billing interval. */
export const resolveProductPrice = (
  productId: string | undefined,
  products: PricedProduct[],
  formatCurrency?: (input: BillingCurrencyFormatInput) => string,
): { formatted: string; interval?: string } | null => {
  if (!productId || !products.length) return null;
  const product = products.find((p) => p.id === productId);
  if (!product) return null;
  if (product.price == null || !product.currency) return null;
  return {
    formatted: formatPrice(product.price, product.currency, formatCurrency),
    interval: product.billingPeriod,
  };
};

const SUPPORTED_INTERVALS: ReadonlySet<string> = new Set([
  "every-month",
  "every-three-months",
  "every-six-months",
  "every-year",
]);

const isSupportedRecurringCycle = (
  value: string,
): value is SupportedRecurringCycle => SUPPORTED_INTERVALS.has(value);

/** Format a canonical Creem billing interval as a compact suffix such as `/mo`. */
export const formatIntervalSuffix = (
  interval: string | undefined,
  labels: BillingLabels = defaultBillingLabels,
): string => {
  if (!interval || !isSupportedRecurringCycle(interval)) return "";
  return labels.priceInterval[interval];
};

/** Format the effective price for a unit-based subscription plan. */
export const formatUnitPrice = (
  productId: string | undefined,
  products: PricedProduct[],
  units: number,
  labels: BillingLabels = defaultBillingLabels,
  formatCurrency?: (input: BillingCurrencyFormatInput) => string,
): string | null => {
  const resolved = resolveProductPrice(productId, products, formatCurrency);
  if (!resolved) return null;
  const suffix = formatIntervalSuffix(resolved.interval, labels);
  if (units <= 1) return `${resolved.formatted}${suffix}`;
  return `${resolved.formatted}${suffix} × ${labels.subscription.unitCount(units)}`;
};

/** Format unit pricing as total plus per-unit calculation text. */
export const formatUnitPriceBreakdown = (
  productId: string | undefined,
  products: PricedProduct[],
  units: number,
  labels: BillingLabels = defaultBillingLabels,
  formatCurrency?: (input: BillingCurrencyFormatInput) => string,
): { total: string; calculation: string } | null => {
  if (!productId || !products.length) return null;
  const product = products.find((p) => p.id === productId);
  if (!product) return null;
  if (product.price == null || !product.currency) return null;

  const suffix = formatIntervalSuffix(product.billingPeriod, labels);
  const unit = `${formatPrice(product.price, product.currency, formatCurrency)}${suffix}`;
  const total = `${formatPrice(product.price * units, product.currency, formatCurrency)}${suffix}`;
  return {
    total,
    calculation: labels.subscription.unitPriceCalculation({
      unitPrice: unit,
      units,
      total,
    }),
  };
};

/** Format a product price with its canonical billing interval suffix. */
export const formatPriceWithInterval = (
  productId: string | undefined,
  products: PricedProduct[],
  labels: BillingLabels = defaultBillingLabels,
  formatCurrency?: (input: BillingCurrencyFormatInput) => string,
): string | null => {
  const resolved = resolveProductPrice(productId, products, formatCurrency);
  if (!resolved) return null;
  return `${resolved.formatted}${formatIntervalSuffix(resolved.interval, labels)}`;
};

/** Split a formatted price label into amount, interval suffix, and trailing calculation text. */
export const splitPriceLabel = (
  value: string | null,
): { main: string; suffix: string | null; tail: string } | null => {
  if (!value) return null;
  const match = value.match(/^(.*?)(\/[a-z0-9]+)(.*)$/i);
  if (!match) return { main: value, suffix: null, tail: "" };
  return {
    main: match[1]?.trim() ?? value,
    suffix: match[2] ?? null,
    tail: match[3]?.trim() ?? "",
  };
};

/** Join CSS class tokens, filtering out falsy values. */
export const cx = (...tokens: Array<string | undefined | false>) =>
  tokens.filter(Boolean).join(" ");
