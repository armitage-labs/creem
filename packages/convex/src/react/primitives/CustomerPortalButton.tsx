import { useState, type PropsWithChildren } from "react";

export const CustomerPortalButton = ({
  href,
  disabled = false,
  className = "",
  onOpenPortal,
  children,
}: PropsWithChildren<{
  href?: string;
  disabled?: boolean;
  className?: string;
  onOpenPortal?: () => Promise<void> | void;
}>) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || isLoading || !onOpenPortal) return;
    setIsLoading(true);
    try {
      await onOpenPortal();
    } finally {
      setIsLoading(false);
    }
  };

  if (onOpenPortal) {
    return (
      <button
        type="button"
        className={`${className || "button-outline"} disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer`}
        disabled={disabled}
        onClick={handleClick}
      >
        {children ?? (isLoading ? "Loading..." : "Manage billing")}
      </button>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className || "button-outline"}
    >
      {children ?? "Manage billing"}
    </a>
  );
};
