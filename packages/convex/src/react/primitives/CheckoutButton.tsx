import { useState, type PropsWithChildren } from "react";

export const CheckoutButton = ({
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
        disabled={disabled}
        onClick={handleClick}
      >
        {children ?? (isLoading ? "Loading..." : "Checkout")}
      </button>
    );
  }

  return (
    <a href={href} className={`button-filled ${className}`}>
      {children ?? "Checkout"}
    </a>
  );
};
