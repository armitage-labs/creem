import type {
  AvailableAction,
  BillingSnapshot,
  UIPlanEntry,
  RecurringCycle,
} from "../../core/types.js";
import type { ConnectedProduct } from "../widgets/types.js";

const CYCLE_KEY_ALIASES: Record<RecurringCycle, string[]> = {
  "every-month": ["every-month", "monthly", "month"],
  "every-three-months": ["every-three-months", "quarterly", "every-quarter"],
  "every-six-months": ["every-six-months", "semiannual", "semi-annually"],
  "every-year": ["every-year", "yearly", "annual"],
  custom: ["custom"],
};

export const formatRecurringCycle = (cycle: RecurringCycle) => {
  if (cycle === "every-month") return "Monthly";
  if (cycle === "every-three-months") return "Quarterly";
  if (cycle === "every-six-months") return "Semi-annual";
  if (cycle === "every-year") return "Yearly";
  return "Custom";
};

export const resolveProductIdForPlan = (
  plan: UIPlanEntry,
  selectedCycle: RecurringCycle | undefined,
) => {
  const productIds = plan.creemProductIds;
  if (!productIds) {
    return undefined;
  }

  const aliases = selectedCycle
    ? CYCLE_KEY_ALIASES[selectedCycle]
    : CYCLE_KEY_ALIASES.custom;
  for (const alias of aliases) {
    if (productIds[alias]) {
      return productIds[alias];
    }
    const partial = Object.entries(productIds).find(([key]) =>
      key.toLowerCase().includes(alias),
    );
    if (partial) {
      return partial[1];
    }
  }

  return Object.values(productIds)[0];
};

export const hasBillingActionLocal = (
  snapshot: BillingSnapshot,
  action: AvailableAction,
) => snapshot.availableActions.includes(action);

export const formatPrice = (amount: number, currency: string): string => {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount / 100);
};

export const resolveProductPrice = (
  productId: string | undefined,
  products: ConnectedProduct[],
): { formatted: string; interval?: string } | null => {
  if (!productId || !products.length) return null;
  const product = products.find((p) => p.id === productId);
  if (!product) return null;
  if (product.price == null || !product.currency) return null;
  const formatted = formatPrice(product.price, product.currency);
  return { formatted, interval: product.billingPeriod ?? undefined };
};

const INTERVAL_LABELS: Record<string, string> = {
  month: "/mo",
  "every-month": "/mo",
  "every-three-months": "/3mo",
  "every-six-months": "/6mo",
  year: "/yr",
  "every-year": "/yr",
};

export const formatSeatPrice = (
  productId: string | undefined,
  products: ConnectedProduct[],
  seats: number,
): string | null => {
  const resolved = resolveProductPrice(productId, products);
  if (!resolved) return null;
  const suffix = resolved.interval
    ? (INTERVAL_LABELS[resolved.interval] ?? "")
    : "";
  if (seats <= 1) {
    return `${resolved.formatted}${suffix}`;
  }
  return `${resolved.formatted}${suffix} × ${seats} seats`;
};

export const formatPriceWithInterval = (
  productId: string | undefined,
  products: ConnectedProduct[],
): string | null => {
  const resolved = resolveProductPrice(productId, products);
  if (!resolved) return null;
  const suffix = resolved.interval
    ? (INTERVAL_LABELS[resolved.interval] ?? "")
    : "";
  return `${resolved.formatted}${suffix}`;
};
