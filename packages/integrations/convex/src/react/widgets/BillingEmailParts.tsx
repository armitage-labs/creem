import type { ComponentPropsWithoutRef } from "react";
import {
  useBillingEmail,
  useBillingEmailPart,
  type BillingEmailContextValue,
} from "./billingEmailContext.js";
import { billingEmailInputDescribedBy } from "../../core/billingEmail.js";

/**
 * Parts of `BillingEmail.Root`. Each one reads the root's context, so it
 * throws outside a root. `class`/`className` adds classes to the part's
 * defaults; with `unstyled` on the root only your classes remain. Other props
 * are forwarded to the element, except the ones the root wires (IDs, value,
 * disabled state, and ARIA references).
 */

type ClassProps = {
  /** CSS class added to the part's defaults. */
  class?: string;
  /** CSS class added to the part's defaults. */
  className?: string;
};

const resolveClass = (
  context: BillingEmailContextValue,
  defaults: string,
  { class: classProp, className }: ClassProps,
) => {
  const custom = className ?? classProp ?? "";
  return context.unstyled ? custom : `${defaults} ${custom}`.trim();
};

/** Heading of the form. Names the form for assistive technology. */
export const BillingEmailTitle = ({
  class: classProp,
  className,
  children,
  ...rest
}: ClassProps & Omit<ComponentPropsWithoutRef<"h3">, "className" | "id">) => {
  const context = useBillingEmail();
  useBillingEmailPart(context, "title");
  return (
    <h3
      {...rest}
      id={context.ids.title}
      className={resolveClass(
        context,
        "creem-base:title-s creem-base:text-foreground-default",
        { class: classProp, className },
      )}
    >
      {children ?? context.labels.title}
    </h3>
  );
};

/** One-line explanation. The input references it with `aria-describedby`. */
export const BillingEmailDescription = ({
  class: classProp,
  className,
  children,
  ...rest
}: ClassProps & Omit<ComponentPropsWithoutRef<"p">, "className" | "id">) => {
  const context = useBillingEmail();
  useBillingEmailPart(context, "description");
  return (
    <p
      {...rest}
      id={context.ids.description}
      className={resolveClass(
        context,
        "creem-base:body-m creem-base:text-foreground-muted",
        { class: classProp, className },
      )}
    >
      {children ?? context.labels.description}
    </p>
  );
};

/**
 * Visible label for the input. Without it the input is named by the
 * `inputLabel` text through `aria-label`.
 */
export const BillingEmailLabel = ({
  class: classProp,
  className,
  children,
  ...rest
}: ClassProps &
  Omit<ComponentPropsWithoutRef<"label">, "className" | "htmlFor">) => {
  const context = useBillingEmail();
  useBillingEmailPart(context, "label");
  return (
    <label
      {...rest}
      htmlFor={context.ids.input}
      className={resolveClass(
        context,
        "creem-base:label-m creem-base:text-foreground-default",
        { class: classProp, className },
      )}
    >
      {children ?? context.labels.inputLabel}
    </label>
  );
};

/** The email input, bound to the draft. */
export const BillingEmailInput = ({
  class: classProp,
  className,
  ...rest
}: ClassProps &
  Omit<
    ComponentPropsWithoutRef<"input">,
    | "className"
    | "id"
    | "type"
    | "value"
    | "defaultValue"
    | "onChange"
    | "disabled"
    | "children"
  >) => {
  const context = useBillingEmail();
  const { state, labels, ids, parts } = context;
  return (
    <input
      name="billingEmail"
      autoComplete="email"
      placeholder={labels.placeholder}
      {...rest}
      type="email"
      id={ids.input}
      aria-label={parts.label ? undefined : labels.inputLabel}
      aria-invalid={context.isInvalid}
      aria-describedby={billingEmailInputDescribedBy(context)}
      value={state.draft}
      disabled={state.status !== "ready" || state.saving}
      onChange={(event) => context.setDraft(event.currentTarget.value)}
      className={resolveClass(
        context,
        "creem-base:input-default creem-base:w-full",
        { class: classProp, className },
      )}
    />
  );
};

/** Submit button. Disabled until the draft is a valid, changed address. */
export const BillingEmailSave = ({
  class: classProp,
  className,
  children,
  ...rest
}: ClassProps &
  Omit<
    ComponentPropsWithoutRef<"button">,
    "className" | "type" | "disabled"
  >) => {
  const context = useBillingEmail();
  return (
    <button
      {...rest}
      type="submit"
      disabled={!context.canSave}
      className={resolveClass(
        context,
        "creem-base:button-filled creem-base:cursor-pointer disabled:creem-base:cursor-not-allowed disabled:creem-base:opacity-60",
        { class: classProp, className },
      )}
    >
      {children ??
        (context.state.saving ? context.labels.saving : context.labels.save)}
    </button>
  );
};

/** Loading and saved messages, announced politely. */
export const BillingEmailStatus = ({
  class: classProp,
  className,
  ...rest
}: ClassProps &
  Omit<ComponentPropsWithoutRef<"p">, "className" | "role" | "children">) => {
  const context = useBillingEmail();
  const message: { text: string; tone: string } | null = context.isLoading
    ? {
        text: context.labels.loading,
        tone: "creem-base:text-foreground-placeholder",
      }
    : context.state.saved
      ? {
          text: context.labels.saved,
          tone: "creem-base:text-success-foreground-default",
        }
      : null;
  if (!message) return null;
  return (
    <p
      {...rest}
      role="status"
      className={resolveClass(context, `creem-base:body-s ${message.tone}`, {
        class: classProp,
        className,
      })}
    >
      {message.text}
    </p>
  );
};

/** The current load or save error. The input references it while shown. */
export const BillingEmailError = ({
  class: classProp,
  className,
  ...rest
}: ClassProps &
  Omit<
    ComponentPropsWithoutRef<"p">,
    "className" | "id" | "role" | "children"
  >) => {
  const context = useBillingEmail();
  useBillingEmailPart(context, "error");
  if (!context.errorMessage) return null;
  return (
    <p
      {...rest}
      id={context.ids.error}
      role="alert"
      className={resolveClass(
        context,
        "creem-base:text-sm creem-base:text-error-foreground-default",
        { class: classProp, className },
      )}
    >
      {context.errorMessage}
    </p>
  );
};

/** Reload button, shown only after the current email failed to load. */
export const BillingEmailRetry = ({
  class: classProp,
  className,
  children,
  ...rest
}: ClassProps &
  Omit<
    ComponentPropsWithoutRef<"button">,
    "className" | "type" | "onClick"
  >) => {
  const context = useBillingEmail();
  if (context.state.status !== "load-error") return null;
  return (
    <button
      {...rest}
      type="button"
      onClick={context.reload}
      className={resolveClass(
        context,
        "creem-base:button-outline creem-base:cursor-pointer",
        { class: classProp, className },
      )}
    >
      {children ?? context.labels.retry}
    </button>
  );
};
