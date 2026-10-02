import {
  useEffect,
  useMemo,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useConvex, useQuery } from "convex/react";
import {
  requireCreemConvexApi,
  useCreemConvex,
} from "../CreemConvexProvider.js";
import type { BillingPermissions, ConnectedBillingModel } from "./types.js";
import { resolveBillingI18n } from "../../core/i18n.js";
import { getConvexErrorMessage } from "../../core/convexError.js";
import {
  canSaveBillingEmail,
  createBillingEmailController,
  isValidBillingEmail,
  normalizeBillingEmail,
} from "../../core/billingEmail.js";

/**
 * Shows and changes the email address Creem sends invoices and receipts to.
 * The Creem customer portal does not offer this.
 *
 * Renders nothing when the billing entity has no Creem customer record yet
 * (customers are created on first checkout), when `canManageBillingEmail` is
 * false, or when `customers.billingEmail` and `customers.updateBillingEmail`
 * are not both wired.
 */
export const BillingEmail = ({
  permissions,
  className,
  class: classProp,
}: {
  /**
   * Local permission override such as `{ canManageBillingEmail: false }`; it
   * hides the widget rather than enforcing access.
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
  const view = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );

  useEffect(() => {
    controller.setEntity(entityKey);
  }, [controller, entityKey]);

  if (entityKey === null || view.status === "no-customer") return null;

  const isLoading = view.status === "idle" || view.status === "loading";
  const canSave = canSaveBillingEmail(view);
  const isInvalid =
    view.status === "ready" &&
    normalizeBillingEmail(view.draft) !== "" &&
    !isValidBillingEmail(view.draft);
  const errorMessage = view.error
    ? getConvexErrorMessage(
        view.error.cause,
        view.error.phase === "load" ? labels.loadFailed : labels.saveFailed,
      )
    : null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void controller.submit();
  };

  return (
    <section
      className={`w-full max-w-md space-y-3 text-left ${className ?? classProp ?? ""}`}
    >
      <div className="space-y-1">
        <h3 className="title-s text-foreground-default">{labels.title}</h3>
        <p className="body-m text-foreground-muted">{labels.description}</p>
      </div>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
        <input
          type="email"
          name="billingEmail"
          autoComplete="email"
          className="input-default w-full sm:flex-1"
          aria-label={labels.inputLabel}
          aria-invalid={isInvalid}
          placeholder={labels.placeholder}
          value={view.draft}
          disabled={view.status !== "ready" || view.saving}
          onChange={(event) => controller.setDraft(event.currentTarget.value)}
        />
        <button
          type="submit"
          className="button-filled cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canSave}
        >
          {view.saving ? labels.saving : labels.save}
        </button>
      </form>
      {isLoading ? (
        <p role="status" className="body-s text-foreground-placeholder">
          {labels.loading}
        </p>
      ) : view.saved ? (
        <p role="status" className="body-s text-success-foreground-default">
          {labels.saved}
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="text-error-foreground-default text-sm">
          {errorMessage}
        </p>
      ) : null}
      {view.status === "load-error" ? (
        <button
          type="button"
          className="button-outline cursor-pointer"
          onClick={controller.reload}
        >
          {labels.retry}
        </button>
      ) : null}
    </section>
  );
};
