import type { PropsWithChildren } from "react";
import { CheckoutButton } from "./CheckoutButton.js";

export const OneTimeCheckoutButton = ({
  productId,
  href,
  disabled = false,
  className = "",
  onCheckout,
  children,
}: PropsWithChildren<{
  productId: string;
  href?: string;
  disabled?: boolean;
  className?: string;
  onCheckout?: (payload: { productId: string }) => Promise<void> | void;
}>) => (
  <CheckoutButton
    productId={productId}
    href={href}
    disabled={disabled}
    className={className}
    onCheckout={onCheckout}
  >
    {children ?? "Buy now"}
  </CheckoutButton>
);
