import { useState, useCallback, type PropsWithChildren } from "react";
import { useConvex } from "convex/react";
import { defaultBillingLabels, type BillingLabels } from "../../core/i18n.js";
import { getConvexErrorMessage } from "../../core/convexError.js";
import { useCreemConvex } from "../CreemConvexProvider.js";
import type { CustomerPortalUrlFunction } from "../../core/connectedApi.js";

/**
 * Button that opens the Creem customer portal for payment recovery.
 *
 * Reads `customers.portalUrl` from `<CreemConvexProvider>` like every other
 * connected widget. Pass `portalUrl` explicitly only when rendering outside a
 * provider. Renders nothing when no portal action is available.
 *
 * @example
 * ```tsx
 * <PaymentRecoveryButton>Update payment method</PaymentRecoveryButton>
 * ```
 */
export const PaymentRecoveryButton = ({
  portalUrl,
  className = "",
  labels = defaultBillingLabels,
  children,
}: PropsWithChildren<{
  /** Override the provider's `customers.portalUrl` action. */
  portalUrl?: CustomerPortalUrlFunction;
  className?: string;
  labels?: BillingLabels;
}>) => {
  const provider = useCreemConvex();
  const resolvedPortalUrl = portalUrl ?? provider?.api?.customers?.portalUrl;
  const client = useConvex();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    if (!resolvedPortalUrl) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.action(resolvedPortalUrl, {});
      window.location.href = result.url;
    } catch (err) {
      setError(getConvexErrorMessage(err, labels.portal.failedToOpen));
      setIsLoading(false);
    }
  }, [client, labels.portal.failedToOpen, resolvedPortalUrl]);

  if (!resolvedPortalUrl) return null;

  return (
    <>
      <button
        type="button"
        className={`button-faded border border-error-border-subtle bg-error-surface-subtle text-error-foreground-default hover:bg-error-surface-tonal disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        disabled={isLoading}
        onClick={handleClick}
      >
        {isLoading
          ? labels.paymentRecovery.openingPortal
          : (children ?? labels.paymentRecovery.updatePaymentMethod)}
      </button>
      {error && (
        <p className="label-s mt-1 text-error-foreground-muted">{error}</p>
      )}
    </>
  );
};
