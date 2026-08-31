import { useMemo, useState, type PropsWithChildren } from "react";
import { useQuery, useConvex } from "convex/react";
import { CustomerPortalButton } from "../primitives/CustomerPortalButton.js";
import {
  requireCreemConvexApi,
  useCreemConvex,
} from "../CreemConvexProvider.js";
import type { BillingPermissions, ConnectedBillingModel } from "./types.js";
import { resolveBillingI18n } from "../../core/i18n.js";
import { getConvexErrorMessage } from "../../core/convexError.js";

/**
 * Button that opens the Creem customer billing portal.
 *
 * Renders nothing when the billing entity has no Creem customer record yet
 * (customers are created on first checkout) or when `canAccessPortal` is false.
 */
export const BillingPortal = ({
  permissions,
  className,
  class: classProp,
  children,
}: PropsWithChildren<{
  /**
   * Local permission override such as `{ canAccessPortal: false }`; it hides
   * the button rather than enforcing access.
   */
  permissions?: BillingPermissions;
  /**
   * CSS class for the wrapper element.
   */
  class?: string;
  /**
   * CSS class for the wrapper element.
   */
  className?: string;
}>) => {
  const provider = useCreemConvex();
  const resolvedApi = requireCreemConvexApi("BillingPortal", provider);
  const resolvedPermissions = permissions ?? provider?.permissions;
  const i18n = useMemo(
    () => resolveBillingI18n(provider?.i18n),
    [provider?.i18n],
  );
  const canAccess = resolvedPermissions?.canAccessPortal !== false;

  const client = useConvex();

  const billingUiModelRef = resolvedApi.uiModel;
  const portalUrlRef = resolvedApi.customers?.portalUrl;

  const modelRaw = useQuery(billingUiModelRef, {});
  const model = modelRaw as ConnectedBillingModel | undefined;
  const hasCreemCustomer = model?.hasCreemCustomer ?? false;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPortal = async () => {
    if (!portalUrlRef) return;
    setIsLoading(true);
    setError(null);
    try {
      const { url } = await client.action(portalUrlRef, {});
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      // Without this the rejection is unhandled and the user gets no feedback
      // at all — the button just stops spinning.
      setError(getConvexErrorMessage(cause, i18n.labels.portal.failedToOpen));
    } finally {
      setIsLoading(false);
    }
  };

  if (!portalUrlRef || !hasCreemCustomer || !canAccess) return null;

  const resolvedClassName = className ?? classProp ?? "";

  return (
    <>
      <CustomerPortalButton
        disabled={isLoading}
        onOpenPortal={openPortal}
        className={resolvedClassName}
        labels={i18n.labels}
      >
        {children ?? i18n.labels.portal.manageBilling}
      </CustomerPortalButton>
      {error ? (
        <p role="alert" className="text-error-foreground-default text-sm">
          {error}
        </p>
      ) : null}
    </>
  );
};
