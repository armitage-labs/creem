import React from "react";
import { CreateCheckoutInput } from "./types";

export interface CreemCheckoutProps extends CreateCheckoutInput {
  /**
   * Custom path for the checkout API route.
   * @default "/checkout"
   * @example "/api/creem/checkout"
   */
  checkoutPath?: string;

  children?: React.ReactNode;
}

export const CreemCheckout = ({
  productId,
  units,
  discountCode,
  customer,
  customFields,
  successUrl,
  metadata,
  referenceId,
  checkoutPath = "/checkout",
  children = "Creem Checkout",
}: CreemCheckoutProps) => {
  // Build query params from checkout input
  const params = new URLSearchParams();
  if (productId) params.append("productId", productId);
  if (units) params.append("units", units.toString());
  if (discountCode) params.append("discountCode", discountCode);
  if (customer) params.append("customer", JSON.stringify(customer));
  if (customFields) params.append("customFields", JSON.stringify(customFields));
  if (successUrl) params.append("successUrl", successUrl);
  if (metadata) params.append("metadata", JSON.stringify(metadata));
  if (referenceId) params.append("referenceId", referenceId);

  const href = `${checkoutPath}?${params.toString()}`;

  return <a href={href}>{children}</a>;
};

export interface CreemPortalProps {
  /**
   * The Creem customer ID to create a portal session for.
   * @required
   * @example "cust_abc123"
   */
  customerId: string;

  /**
   * Custom path for the portal API route.
   * @default "/portal"
   * @example "/api/creem/portal"
   */
  portalPath?: string;

  children?: React.ReactNode;
}

export const CreemPortal = ({
  customerId,
  portalPath = "/portal",
  children = "Portal",
  ...linkProps
}: CreemPortalProps & Omit<React.ComponentProps<"a">, "href">) => {
  const params = new URLSearchParams();
  if (customerId) params.append("customerId", customerId);

  const href = `${portalPath}?${params.toString()}`;

  return (
    <a href={href} {...linkProps}>
      {children}
    </a>
  );
};
