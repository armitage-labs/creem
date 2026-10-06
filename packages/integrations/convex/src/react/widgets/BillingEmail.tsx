import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { useConvex, useQuery } from "convex/react";
import {
  requireCreemConvexApi,
  useCreemConvex,
} from "../CreemConvexProvider.js";
import type { BillingPermissions, ConnectedBillingModel } from "./types.js";
import { resolveBillingI18n } from "../../core/i18n.js";
import {
  billingEmailElementIds,
  createBillingEmailController,
  deriveBillingEmailView,
  type BillingEmailPart,
} from "../../core/billingEmail.js";
import {
  BillingEmailContext,
  type BillingEmailContextValue,
} from "./billingEmailContext.js";
import {
  BillingEmailDescription,
  BillingEmailError,
  BillingEmailInput,
  BillingEmailRetry,
  BillingEmailSave,
  BillingEmailStatus,
  BillingEmailTitle,
} from "./BillingEmailParts.js";

type PartCounts = Record<BillingEmailPart, number>;

const noParts: PartCounts = { title: 0, description: 0, label: 0, error: 0 };

/** The layout `BillingEmail.Root` renders when it has no children. */
const BillingEmailDefaultLayout = ({ unstyled }: { unstyled: boolean }) => (
  <>
    <div className={unstyled ? undefined : "space-y-1"}>
      <BillingEmailTitle />
      <BillingEmailDescription />
    </div>
    <div className={unstyled ? undefined : "flex flex-col gap-2 sm:flex-row"}>
      <BillingEmailInput className={unstyled ? undefined : "sm:flex-1"} />
      <BillingEmailSave />
    </div>
    <BillingEmailStatus />
    <BillingEmailError />
    <BillingEmailRetry />
  </>
);

/**
 * Shows and changes the email address Creem sends invoices and receipts to.
 * The Creem customer portal does not offer this.
 *
 * Renders a `<form>` that owns the state and provides it to the
 * `BillingEmail.*` parts. Without children it renders the default layout.
 *
 * Renders nothing when the billing entity has no Creem customer record yet
 * (customers are created on first checkout), when `canManageBillingEmail` is
 * false, or when `customers.billingEmail` and `customers.updateBillingEmail`
 * are not both wired.
 */
export const BillingEmailRoot = ({
  permissions,
  unstyled = false,
  className,
  class: classProp,
  children,
  ...rest
}: Omit<
  ComponentPropsWithoutRef<"form">,
  "className" | "children" | "onSubmit"
> & {
  /**
   * Local permission override such as `{ canManageBillingEmail: false }`; it
   * hides the form rather than enforcing access.
   */
  permissions?: BillingPermissions;
  /** Drop the default classes of the root and every part. */
  unstyled?: boolean;
  /**
   * CSS class added to the form's defaults.
   */
  class?: string;
  /**
   * CSS class added to the form's defaults.
   */
  className?: string;
  /** Custom layout built from `BillingEmail.*` parts, or a render function. */
  children?: ReactNode | ((context: BillingEmailContextValue) => ReactNode);
}) => {
  const provider = useCreemConvex();
  const resolvedApi = requireCreemConvexApi("BillingEmail", provider);
  const resolvedPermissions = permissions ?? provider?.permissions;
  const i18n = useMemo(
    () => resolveBillingI18n(provider?.i18n),
    [provider?.i18n],
  );
  const labels = i18n.labels.billingEmail;
  const canManage = resolvedPermissions?.canManageBillingEmail !== false;

  const client = useConvex();

  const billingEmailRef = resolvedApi.customers?.billingEmail;
  const updateBillingEmailRef = resolvedApi.customers?.updateBillingEmail;

  const model = useQuery(resolvedApi.uiModel, {}) as
    | ConnectedBillingModel
    | undefined;

  // The snapshot carries the entity the resolver picked, so switching the
  // active organization changes this key and resets the form.
  const entityKey =
    billingEmailRef &&
    updateBillingEmailRef &&
    canManage &&
    model?.hasCreemCustomer
      ? (model.snapshot?.entityId ?? null)
      : null;

  const controller = useMemo(
    () =>
      createBillingEmailController({
        load: async (expectedEntityId) =>
          billingEmailRef
            ? await client.action(billingEmailRef, { expectedEntityId })
            : { status: "no-customer" },
        save: async (expectedEntityId, email) =>
          updateBillingEmailRef
            ? await client.action(updateBillingEmailRef, {
                expectedEntityId,
                email,
              })
            : { status: "no-customer" },
      }),
    [client, billingEmailRef, updateBillingEmailRef],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );

  useEffect(() => {
    controller.setEntity(entityKey);
  }, [controller, entityKey]);

  const baseId = useId();
  const ids = useMemo(() => billingEmailElementIds(baseId), [baseId]);

  // Counted rather than flagged so that a part rendered twice stays
  // registered until both copies unmount.
  const [partCounts, setPartCounts] = useState<PartCounts>(noParts);
  const registerPart = useCallback((part: BillingEmailPart) => {
    setPartCounts((counts) => ({ ...counts, [part]: counts[part] + 1 }));
    return () =>
      setPartCounts((counts) => ({ ...counts, [part]: counts[part] - 1 }));
  }, []);
  const parts = useMemo(
    () => ({
      title: partCounts.title > 0,
      description: partCounts.description > 0,
      label: partCounts.label > 0,
      error: partCounts.error > 0,
    }),
    [partCounts],
  );

  const context = useMemo<BillingEmailContextValue>(
    () => ({
      state,
      ...deriveBillingEmailView(state, labels),
      labels,
      unstyled,
      ids,
      parts,
      setDraft: controller.setDraft,
      markTouched: controller.markTouched,
      submit: () => void controller.submit(),
      reload: controller.reload,
      registerPart,
    }),
    [state, labels, unstyled, ids, parts, controller, registerPart],
  );

  if (entityKey === null || state.status === "no-customer") return null;

  const custom = className ?? classProp ?? "";
  return (
    <BillingEmailContext.Provider value={context}>
      <form
        {...rest}
        noValidate
        aria-labelledby={parts.title ? ids.title : undefined}
        className={
          unstyled
            ? custom
            : `creem-base:w-full creem-base:max-w-md creem-base:space-y-3 creem-base:text-left ${custom}`.trim()
        }
        onSubmit={(event) => {
          event.preventDefault();
          context.submit();
        }}
      >
        {typeof children === "function"
          ? children(context)
          : (children ?? <BillingEmailDefaultLayout unstyled={unstyled} />)}
      </form>
    </BillingEmailContext.Provider>
  );
};
