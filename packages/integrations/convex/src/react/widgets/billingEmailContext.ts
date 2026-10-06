import { createContext, useContext, useEffect } from "react";
import type {
  BillingEmailContextBase,
  BillingEmailPart,
} from "../../core/billingEmail.js";

/**
 * The value `BillingEmail.Root` provides to its parts: the form state, the
 * element IDs that wire labels and descriptions, and the form actions.
 */
export type BillingEmailContextValue = BillingEmailContextBase & {
  /** Announce a mounted part so the input can reference it. */
  registerPart: (part: BillingEmailPart) => () => void;
};

export const BillingEmailContext =
  createContext<BillingEmailContextValue | null>(null);

/**
 * Reads the `BillingEmail.Root` context.
 *
 * @throws When called outside a `BillingEmail.Root`.
 */
export const useBillingEmail = (): BillingEmailContextValue => {
  const context = useContext(BillingEmailContext);
  if (!context) {
    throw new Error(
      "BillingEmail parts must be used inside <BillingEmail.Root>.",
    );
  }
  return context;
};

/** Registers a part with the root for as long as it is mounted. */
export const useBillingEmailPart = (
  context: BillingEmailContextValue,
  part: BillingEmailPart,
) => {
  const { registerPart } = context;
  useEffect(() => registerPart(part), [registerPart, part]);
};
