"use client";

import * as React from "react";
import {
  openCheckout,
  mount,
  captureAffiliateRef,
  CreemEmbedCheckout,
  type CreemCheckoutCompleted,
  type CreemCheckoutOptions,
  type CreemCheckoutHandle,
} from "@creem_io/embed";

// @creem_io/react — React components to embed Creem checkout (modal & inline).
// Thin wrapper over @creem_io/embed.

export {
  openCheckout,
  captureAffiliateRef,
  CreemEmbedCheckout,
  type CreemCheckoutCompleted,
  type CreemCheckoutOptions,
  type CreemCheckoutHandle,
};

/** Hook returning an imperative opener. */
export function useCreemCheckout(): (options: CreemCheckoutOptions) => CreemCheckoutHandle {
  return React.useCallback((options: CreemCheckoutOptions) => openCheckout(options), []);
}

export interface CreemCheckoutProps extends CreemCheckoutOptions {
  /** A single clickable child (e.g. a <button>) that triggers the overlay. */
  children: React.ReactElement;
}

/**
 * Declarative trigger — wraps a clickable child; clicking opens the overlay.
 * The child's own onClick still runs (unless it calls preventDefault).
 */
export function CreemCheckout({ children, ...options }: CreemCheckoutProps): React.ReactElement {
  const childOnClick = (children.props as { onClick?: (event: React.MouseEvent) => void }).onClick;
  const handleClick = (event: React.MouseEvent): void => {
    childOnClick?.(event);
    if (event.defaultPrevented) return;
    openCheckout(options);
  };
  return React.cloneElement(children, { onClick: handleClick });
}

export interface CreemCheckoutInlineProps extends CreemCheckoutOptions {
  className?: string;
  style?: React.CSSProperties;
}

/** Inline embed — mounts the checkout iframe into a ref'd element. */
export function CreemCheckoutInline({
  checkoutUrl,
  theme,
  locale,
  onComplete,
  onReady,
  className,
  style,
}: CreemCheckoutInlineProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handle = mount({
      checkoutUrl,
      theme,
      locale,
      onComplete,
      onReady,
      container,
    });
    return () => handle.destroy();
    // Re-mount only when the target checkout / presentation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutUrl, theme, locale]);
  return <div ref={containerRef} className={className} style={style} />;
}
