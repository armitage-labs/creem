import { useState, type PropsWithChildren } from "react";
import { defaultBillingLabels, type BillingLabels } from "../../core/i18n.js";

/**
 * Styled checkout button.
 *
 * Works in callback mode via `onCheckout` or link mode via `href`. A low-level
 * primitive: inside a `Subscription.Root`, use `Subscription.ItemCTA`, which is
 * wired to the root's checkout flow.
 */
export const CheckoutButton = ({
  productId,
  href,
  disabled = false,
  className = "",
  onCheckout,
  labels = defaultBillingLabels,
  children,
}: PropsWithChildren<{
  /**
   * Creem product to check out, passed back to `onCheckout`.
   */
  productId: string;
  /**
   * Link mode: navigate straight to this URL instead of calling `onCheckout`.
   */
  href?: string;
  /**
   * Disable the button, for example while a checkout is already in flight.
   */
  disabled?: boolean;
  /**
   * CSS class for the wrapper element.
   */
  className?: string;
  /**
   * Callback mode: receives `{ productId }` when the button is pressed.
   */
  onCheckout?: (payload: { productId: string }) => Promise<void> | void;
  /**
   * Label overrides for the default button text.
   */
  labels?: BillingLabels;
}>) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || isLoading || !onCheckout) return;
    setIsLoading(true);
    try {
      await onCheckout({ productId });
    } finally {
      setIsLoading(false);
    }
  };

  if (onCheckout) {
    return (
      <button
        type="button"
        className={`button-filled disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        // Disable while in flight, not just when the caller says so: every card
        // passes its own `children`, which hides the loading label, so without
        // this the button looks idle and invites a second checkout session.
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        onClick={handleClick}
      >
        {children ??
          (isLoading ? labels.checkout.loading : labels.checkout.checkout)}
      </button>
    );
  }

  // No handler and no href would render an unfocusable fake button, so render
  // nothing rather than something that looks clickable but is not.
  if (!href) return null;

  return (
    <a href={href} className={`button-filled ${className}`}>
      {children ?? labels.checkout.checkout}
    </a>
  );
};
