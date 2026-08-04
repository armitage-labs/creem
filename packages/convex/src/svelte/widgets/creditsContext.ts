import { getContext } from "svelte";
import type { BillingLabels } from "../../core/i18n.js";

export const CREDITS_CONTEXT_KEY = Symbol("credits-context");

/**
 * The value `Credits.Root` provides to its slots: balance, loading and error
 * state, and `refresh()`.
 */
export interface CreditsContextValue {
  readonly balance: string | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly unitLabel: string;
  readonly labels: BillingLabels;
  refresh: () => Promise<void>;
}

/**
 * Reads the `Credits.Root` context: balance, loading and error state, and
 * `refresh()`.
 *
 * @throws When called outside a `Credits.Root`.
 */
export const getCreditsContext = () => {
  const context = getContext<CreditsContextValue | undefined>(
    CREDITS_CONTEXT_KEY,
  );
  if (!context) {
    throw new Error("Credits slots must be used inside <Credits.Root>.");
  }
  return context;
};
