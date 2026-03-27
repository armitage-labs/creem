import { useState, type PropsWithChildren } from "react";
import { useQuery, useConvex } from "convex/react";
import { CustomerPortalButton } from "../primitives/CustomerPortalButton.js";
import type {
  BillingPermissions,
  ConnectedBillingApi,
  ConnectedBillingModel,
} from "./types.js";

export const BillingPortal = ({
  api,
  permissions,
  className = "",
  children,
}: PropsWithChildren<{
  api: ConnectedBillingApi;
  permissions?: BillingPermissions;
  class?: string;
  className?: string;
}>) => {
  const canAccess = permissions?.canAccessPortal !== false;

  const client = useConvex();

  const billingUiModelRef = api.uiModel;
  const portalUrlRef = api.customers?.portalUrl;

  const modelRaw = useQuery(billingUiModelRef, {});
  const model = modelRaw as ConnectedBillingModel | undefined;
  const hasCreemCustomer = model?.hasCreemCustomer ?? false;

  const [isLoading, setIsLoading] = useState(false);

  const openPortal = async () => {
    if (!portalUrlRef) return;
    setIsLoading(true);
    try {
      const { url } = await client.action(portalUrlRef, {});
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setIsLoading(false);
    }
  };

  if (!portalUrlRef || !hasCreemCustomer || !canAccess) return null;

  return (
    <CustomerPortalButton
      disabled={isLoading}
      onOpenPortal={openPortal}
      className={className}
    >
      {children ?? "Manage billing"}
    </CustomerPortalButton>
  );
};
