export type CreemProduct = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  billing_type: "onetime" | "recurring";
  billing_period?: string | null;
  status?: "active" | "archived";
  features?: { id: string; type: string; description?: string }[];
};

export function intervalToSelect(p: Pick<CreemProduct, "billing_type" | "billing_period">): string {
  if (p.billing_type !== "recurring") return "oneTime";
  switch (p.billing_period) {
    case "every-day":
      return "day";
    case "every-month":
      return "month";
    case "every-three-months":
      return "3months";
    case "every-six-months":
      return "6months";
    case "every-year":
      return "year";
    default:
      return "month";
  }
}

export function subscriptionFrequencyLabel(p: Pick<CreemProduct, "billing_period">): string | null {
  switch (p.billing_period) {
    case "every-day":
      return "Daily";
    case "every-month":
      return "Monthly";
    case "every-three-months":
      return "Every 3 months";
    case "every-six-months":
      return "Every 6 months";
    case "every-year":
      return "Yearly";
    default:
      return p.billing_period ?? null;
  }
}

export function formatPrice(product: Pick<CreemProduct, "price" | "currency"> | undefined): string {
  if (!product) return "-";
  if ((product.price ?? 0) === 0) return "Free";
  const major = product.price / 100;
  const cur = (product.currency ?? "").toUpperCase();
  return `${major} ${cur}`;
}

export function featureCount(product: Pick<CreemProduct, "features">): number {
  return product.features?.length ?? 0;
}

export function isRecurring(product: Pick<CreemProduct, "billing_type">): boolean {
  return product.billing_type === "recurring";
}

export function creemDashboardProductUrl(productId: string): string {
  return `https://www.creem.io/dashboard/products/edit/${productId}`;
}
