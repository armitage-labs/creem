import { getContext } from "svelte";
import type {
  BillingEmailContextBase,
  BillingEmailPart,
} from "../../core/billingEmail.js";

export const BILLING_EMAIL_CONTEXT_KEY = Symbol("billing-email-context");

/**
 * The value `BillingEmail.Root` provides to its parts: the form state, the
 * element IDs that wire labels and descriptions, and the form actions.
 */
export interface BillingEmailContextValue extends BillingEmailContextBase {
  /** Announce a mounted part so the input can reference it. */
  registerPart: (part: BillingEmailPart) => () => void;
}

/**
 * Reads the `BillingEmail.Root` context.
 *
 * @throws When called outside a `BillingEmail.Root`.
 */
export const getBillingEmailContext = (): BillingEmailContextValue => {
  const context = getContext<BillingEmailContextValue | undefined>(
    BILLING_EMAIL_CONTEXT_KEY,
  );
  if (!context) {
    throw new Error(
      "BillingEmail parts must be used inside <BillingEmail.Root>.",
    );
  }
  return context;
};

/** A part's classes: its defaults plus `custom`, or only `custom` when unstyled. */
export const resolveBillingEmailClass = (
  context: BillingEmailContextValue,
  defaults: string,
  custom: string,
): string => (context.unstyled ? custom : `${defaults} ${custom}`.trim());
